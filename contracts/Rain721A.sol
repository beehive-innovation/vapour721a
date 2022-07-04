// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/access/Ownable.sol";
import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@beehiveinnovation/rain-protocol/contracts/vm/RainVM.sol";
import {AllStandardOps} from "@beehiveinnovation/rain-protocol/contracts/vm/ops/AllStandardOps.sol";
import "@beehiveinnovation/rain-protocol/contracts/vm/VMStateBuilder.sol";
import "./Random.sol";
import "./SeedDance.sol";
import "hardhat/console.sol";

struct ConstructorConfig {
    string name;
    string symbol;
    string defaultURI;
    string baseURI;
    uint256 supplyLimit;
    address recipient;
    address owner;
    TimeBound timeBound;
}

struct InitializeConfig {
    address[] currencies;
    address vmStateBuilder;
    StateConfig vmStateConfig;
}

contract Rain721A is ERC721A, RainVM, SeedDance, Ownable {
    using Strings for uint256;
    uint256 public supplyLimit;

    TimeBound timeBound;

    address private vmStatePointer;
    address[] public currencies;
    address payable public recipient;

    address public shuffled;

    string public defaultURI;
    string public baseURI;

    mapping(address => uint256) private paymentTokenIndex;

    event Construct(ConstructorConfig config_);
    event Initialize(InitializeConfig config_);
    event RecipientChanged(address newRecipient);
    event IdRevealed(uint256 _timeStamp);

    constructor(ConstructorConfig memory config_)
        ERC721A(config_.name, config_.symbol)
    {
        supplyLimit = config_.supplyLimit;
        baseURI = config_.baseURI;
        defaultURI = config_.defaultURI;
        timeBound = config_.timeBound;

        setRecipient(config_.recipient);
        transferOwnership(config_.owner);

        emit Construct(config_);
    }

    function initialize(InitializeConfig memory config_) external {
        require(vmStatePointer == address(0), "INITIALIZED");

        currencies = config_.currencies;
        for (uint256 i = 0; i < currencies.length; i++)
            paymentTokenIndex[currencies[i]] = i + 1;

        Bounds memory canMint;
        canMint.entrypoint = 0;
        Bounds memory price;
        price.entrypoint = 1;
        Bounds[] memory boundss_ = new Bounds[](2);
        boundss_[0] = canMint;
        boundss_[1] = price;
        bytes memory vmStateBytes_ = VMStateBuilder(config_.vmStateBuilder)
            .buildState(address(this), config_.vmStateConfig, boundss_);
        vmStatePointer = SSTORE2.write(vmStateBytes_);

        emit Initialize(config_);
    }

    function _startTokenId() internal view virtual override returns (uint256) {
        return 1;
    }

    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        if (!_exists(tokenId)) revert URIQueryForNonexistentToken();
        console.log(Random.shuffleIdAtIndex(shuffled, tokenId).toString());
        if (shuffled == address(0)) return defaultURI;
        return
            string(
                abi.encodePacked(
                    baseURI,
                    "/",
                    Random.shuffleIdAtIndex(shuffled, tokenId - 1).toString(),
                    ".json"
                )
            );
    }

    function _loadState() internal view returns (State memory) {
        return LibState.fromBytesPacked(SSTORE2.read(vmStatePointer));
    }

    function startReveal(Seed initialSeed_) external {
        require(totalSupply() == supplyLimit, "CANT_START_REVEAL");
        _start(initialSeed_);
    }

    function commit(Commitment commit_, uint256 units_) external payable {
        require(vmStatePointer != address(0), "NOT_INITIALIZED");
        require((_currentIndex - 1) + units_ <= supplyLimit, "MAX_LIMIT");
        _commit(commit_);
        for (uint256 i = 0; i < currencies.length; i = i + 1) {
            uint256[] memory stack_ = getPrice(currencies[i], units_);
            // if (stack_[0] == 0) {
            //     Address.sendValue(recipient, stack_[1]);
            // } else
            if (stack_[0] == 0) {
                ITransfer(currencies[i]).transferFrom(
                    msg.sender,
                    recipient,
                    stack_[1]
                );
            } else if (stack_[0] == 1) {
                ITransfer(currencies[i]).safeTransferFrom(
                    msg.sender,
                    recipient,
                    stack_[1],
                    stack_[2],
                    ""
                );
            }
        }
        _mint(_msgSender(), units_);
    }

    function reveal(Secret secret_) external {
        _reveal(timeBound, secret_);
    }

    function revealIds() external {
        require(totalSupply() == supplyLimit, "CANT_REVEAL_IDS");
        shuffled = SSTORE2.write(
            Random.shuffle(Seed.unwrap(_sharedSeed), supplyLimit)
        );
        emit IdRevealed(block.timestamp);
    }

    function setRecipient(address newRecipient) public {
        require(
            msg.sender == recipient || recipient == address(0),
            "RECIPIENT_ONLY"
        );
        require(
            newRecipient.code.length == 0 && newRecipient != address(0),
            "INVALID_ADDRESS."
        );
        recipient = payable(newRecipient);
        emit RecipientChanged(newRecipient);
    }

    function canMint(address account_) public view returns (bool) {
        bytes memory context_ = new bytes(0x20);
        assembly {
            mstore(add(context_, 0x20), account_)
        }
        State memory state_ = _loadState();
        eval(context_, state_, 0);
        return (state_.stack[state_.stackIndex - 1] == 1);
    }

    function getPrice(address paymentToken_, uint256 units_)
        public
        view
        returns (uint256[] memory)
    {
        State memory state_ = _loadState();
        eval("", state_, 1);
        uint256[] memory stack = state_.stack;

        uint256 stackPointer;
        uint256 paymentTokenIndex_ = paymentTokenIndex[paymentToken_];
        require(paymentTokenIndex_ != 0, "INVALID_TOKEN");

        for (uint256 i = 0; i < paymentTokenIndex_ - 1; i++) {
            if (stack[stackPointer] == 0) {
                unchecked {
                    stackPointer = stackPointer + 2;
                }
            } else if (stack[stackPointer] == 1) {
                unchecked {
                    stackPointer = stackPointer + 3;
                }
            }
        }

        uint256[] memory price = new uint256[](3);
        if (stack[stackPointer] == 0) {
            price[0] = stack[stackPointer];
            price[1] = stack[stackPointer + 1] * units_;
        } else if (stack[stackPointer] == 1) {
            price[0] = stack[stackPointer];
            price[1] = stack[stackPointer + 1];
            price[2] = stack[stackPointer + 2] * units_;
        }

        return price;
    }

    function _beforeTokenTransfers(
        address from,
        address to,
        uint256 startTokenId,
        uint256 quantity
    ) internal virtual override {
        if (from == address(0)) require(canMint(to), "CANT MINT");
    }

    function fnPtrs() public pure override returns (bytes memory) {
        return AllStandardOps.fnPtrs();
    }
}

interface ITransfer {
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes calldata data
    ) external;

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);
}
