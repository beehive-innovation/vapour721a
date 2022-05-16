// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@beehiveinnovation/rain-protocol/contracts/tier/libraries/TierReport.sol";
import "@beehiveinnovation/rain-protocol/contracts/vm/RainVM.sol";
import {VMState, StateConfig} from "@beehiveinnovation/rain-protocol/contracts/vm/libraries/VMState.sol";
import {AllStandardOps, ALL_STANDARD_OPS_START, ALL_STANDARD_OPS_LENGTH} from "@beehiveinnovation/rain-protocol/contracts/vm/ops/AllStandardOps.sol";

struct Config {
    StateConfig priceScript;
    StateConfig canMintScript;
    address[] currencies;
    address payable recipient;
}

contract Rain721A is ERC721A, RainVM, VMState {
    uint256 internal constant TIER_REPORT_AT_BLOCK = 0;

    uint256 internal constant ACCOUNT = 1;

    uint256 internal constant LOCAL_OPS_LENGTH = 2;

    uint256 private immutable localOpsStart =
        ALL_STANDARD_OPS_START + ALL_STANDARD_OPS_LENGTH;

    State private priceScript;
    State private canMintScript;
    address[] private currencies;
    address payable recipient;

    event Initialize(Config _config);

    constructor(Config memory _config) ERC721A("Rain721A", "") {
        priceScript = _restore(_snapshot(_newState(_config.priceScript)));
        canMintScript = _restore(_snapshot(_newState(_config.canMintScript)));
        currencies = _config.currencies;
        recipient = _config.recipient;
    }

    function _startTokenId() internal view virtual override returns (uint256) {
        return 1;
    }

    function canMint(address _account) public view returns (bool) {
        State memory state_ = canMintScript;
        eval(abi.encode(_account), state_, 0);

        return (state_.stack[state_.stackIndex - 1] == 1);
    }

    function getPrice(address _paymentToken, uint256 quantity)
        public
        view
        returns (uint256[] memory)
    {
        uint256 sourceIndex = 0;
        while (_paymentToken != currencies[sourceIndex]) {
            sourceIndex++;
        }

        State memory state_ = priceScript;
        eval("", state_, sourceIndex);
        state_.stack[state_.stackIndex - 1] =
            state_.stack[state_.stackIndex - 1] *
            quantity;

        return state_.stack;
    }

    function _beforeTokenTransfers(
        address from,
        address to,
        uint256 startTokenId,
        uint256 quantity
    ) internal virtual override {
        if (from == address(0)) require(canMint(to), "Cant Mint");
    }

    function mint(uint256 quantity) external payable {
        for (uint256 i = 0; i < currencies.length; i = i + 1) {
            uint256[] memory stack_ = getPrice(currencies[i], quantity);
            if (stack_[0] == 0) {
                require(msg.value >= stack_[1], "Insufficient funds.");
                Address.sendValue(recipient, stack_[1]);
            } else if (stack_[0] == 1) {
                ITransfer(currencies[i]).transferFrom(
                    msg.sender,
                    recipient,
                    stack_[1]
                );
            } else if (stack_[0] == 2) {
                ITransfer(currencies[i]).safeTransferFrom(
                    msg.sender,
                    recipient,
                    stack_[1],
                    stack_[2],
                    ""
                );
            }
        }

        _safeMint(msg.sender, quantity);
    }

    function applyOp(
        bytes memory context_,
        State memory state_,
        uint256 opcode_,
        uint256 operand_
    ) internal view virtual override {
        unchecked {
            if (opcode_ < localOpsStart) {
                AllStandardOps.applyOp(
                    state_,
                    opcode_ - ALL_STANDARD_OPS_START,
                    operand_
                );
            } else {
                opcode_ -= localOpsStart;
                require(opcode_ < LOCAL_OPS_LENGTH, "MAX_OPCODE");
                // There's only one opcode, which stacks the address to report.
                if (opcode_ == TIER_REPORT_AT_BLOCK) {
                    state_.stack[state_.stackIndex - 2] = TierReport
                        .tierAtBlockFromReport(
                            state_.stack[state_.stackIndex - 2],
                            state_.stack[state_.stackIndex - 1]
                        );
                    state_.stackIndex--;
                } else if (opcode_ == ACCOUNT) {
                    address account_ = abi.decode(context_, (address));
                    state_.stack[state_.stackIndex] = uint256(
                        uint160(account_)
                    );
                    state_.stackIndex++;
                }
            }
        }
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
