// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "erc721a/contracts/ERC721A.sol";
import "@beehiveinnovation/rain-protocol/contracts/vm/RainVM.sol";
import "@beehiveinnovation/rain-protocol/contracts/vm/ops/AllStandardOps.sol";
import "@beehiveinnovation/rain-protocol/contracts/vm/VMStateBuilder.sol";
import "hardhat/console.sol";

/**
 * config for deploying Rain721A contract
 */
struct ConstructorConfig {
	string name;
	string symbol;
	string baseURI;
	uint256 supplyLimit;
	address recipient;
	address owner;
}

/**
config for Initializing VMstateConfig
 */

struct InitializeConfig {
	address currency;
	address vmStateBuilder;
	StateConfig vmStateConfig;
}

contract Rain721A is ERC721A, RainVM, Ownable {
	using Strings for uint256;
	using Math for uint256;
	using LibFnPtrs for bytes;

	uint256 immutable STORAGE_OPCODES_LENGTH = 3;

	// the total numbers of tokens
	uint256 constant LOCAL_OP_TOTAL_SUPPLY = ALL_STANDARD_OPS_LENGTH;
	// the total unites minted
	uint256 constant LOCAL_OP_TOTAL_MINTED = LOCAL_OP_TOTAL_SUPPLY + 1;
	// number of tokens minted by `owner`.
	uint256 constant LOCAL_OP_NUMBER_MINTED = LOCAL_OP_TOTAL_MINTED + 1;
	// number of tokens burned by `owner`.
	uint256 constant LOCAL_OP_NUMBER_BURNED = LOCAL_OP_NUMBER_MINTED + 1;

	uint256 immutable LOCAL_OPS_LENGTH = 4;

	// storage variables
	uint256 public supplyLimit;
	uint256 private amountWithdrawn;
	uint256 private amountPayable;

	address private vmStatePointer;
	address public currency;
	address payable public recipient;

	string public baseURI;

	event Construct(ConstructorConfig config_);
	event Initialize(InitializeConfig config_);
	event RecipientChanged(address newRecipient);
	event Withdraw(
		address withdrawer,
		uint256 amountWithdrawn,
		uint256 totalWithdrawn
	);

	constructor(ConstructorConfig memory config_)
		ERC721A(config_.name, config_.symbol)
	{
		supplyLimit = config_.supplyLimit;
		baseURI = config_.baseURI;

		setRecipient(config_.recipient);
		transferOwnership(config_.owner);

		emit Construct(config_);
	}

	function initialize(InitializeConfig memory config_) external {
		require(vmStatePointer == address(0), "INITIALIZED");

		currency = config_.currency;

		Bounds memory vmScript;
		vmScript.entrypoint = 0;
		Bounds[] memory boundss_ = new Bounds[](1);
		boundss_[0] = vmScript;
		bytes memory vmStateBytes_ = VMStateBuilder(config_.vmStateBuilder)
			.buildState(address(this), config_.vmStateConfig, boundss_);
		vmStatePointer = SSTORE2.write(vmStateBytes_);

		emit Initialize(config_);
	}

	/// @inheritdoc RainVM
	function storageOpcodesRange()
		public
		pure
		override
		returns (StorageOpcodesRange memory)
	{
		uint256 slot_;
		assembly {
			slot_ := supplyLimit.slot
		}
		return StorageOpcodesRange(slot_, STORAGE_OPCODES_LENGTH);
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
		return string(abi.encodePacked(baseURI, "/", tokenId.toString(), ".json"));
	}

	function _loadState() internal view returns (State memory) {
		return LibState.fromBytesPacked(SSTORE2.read(vmStatePointer));
	}

	function mintNFT(uint256 units_) external payable {
		require(vmStatePointer != address(0), "NOT_INITIALIZED");
		State memory state_ = _loadState();
		bytes memory context_ = new bytes(0x20);
		assembly {
			mstore(add(context_, 0x20), units_)
		}
		eval(context_, state_, 0);

		(uint256 maxUnits_, uint256 price_) = (
			state_.stack[state_.stackIndex - 2],
			state_.stack[state_.stackIndex - 1]
		);

		uint256 units = maxUnits_.min(units_);
		amountPayable = amountPayable + price_;
		_mint(msg.sender, units);
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

	function _beforeTokenTransfers(
		address from,
		address to,
		uint256 startTokenId,
		uint256 quantity
	) internal virtual override {
		bytes memory context_ = new bytes(0x20);
		assembly {
			mstore(add(context_, 0x20), to)
		}
		State memory state_ = _loadState();
		eval(context_, state_, 0);

		uint256 units_ = quantity.min(state_.stack[0]);

		if (from == address(0)) require(units_ != 0, "CANT MINT");
	}

	function opTotalSupply(uint256, uint256 stackTopLocation_)
		internal
		view
		returns (uint256)
	{
		uint256 totalSupply_ = totalSupply();
		assembly {
			mstore(stackTopLocation_, totalSupply_)
		}
		return stackTopLocation_ + 1;
	}

	function opTotalMinted(uint256, uint256 stackTopLocation_)
		internal
		view
		returns (uint256)
	{
		uint256 location_;
		assembly {
			location_ := sub(stackTopLocation_, 0x20)
		}
		uint256 totalMinted_ = _totalMinted();
		assembly {
			mstore(location_, totalMinted_)
		}
		return stackTopLocation_;
	}

	function opNumberMinted(uint256, uint256 stackTopLocation_)
		internal
		view
		returns (uint256)
	{
		uint256 location_;
		address account_;
		assembly {
			location_ := sub(stackTopLocation_, 0x20)
			account_ := mload(location_)
		}
		uint256 totalMinted_ = _numberMinted(account_);
		assembly {
			mstore(location_, totalMinted_)
		}
		return stackTopLocation_;
	}

	function opNumberBurned(uint256, uint256 stackTopLocation_)
		internal
		view
		returns (uint256)
	{
		uint256 location_;
		address account_;
		assembly {
			location_ := sub(stackTopLocation_, 0x20)
			account_ := mload(location_)
		}
		uint256 totalMinted_ = _numberBurned(account_);
		assembly {
			mstore(location_, totalMinted_)
		}
		return stackTopLocation_;
	}

	function localFnPtrs() internal pure returns (bytes memory localFnPtrs_) {
		unchecked {
			localFnPtrs_ = new bytes(LOCAL_OPS_LENGTH * 0x20);
			localFnPtrs_.insertOpPtr(
				LOCAL_OP_TOTAL_SUPPLY - ALL_STANDARD_OPS_LENGTH,
				opTotalSupply
			);
			localFnPtrs_.insertOpPtr(
				LOCAL_OP_TOTAL_MINTED - ALL_STANDARD_OPS_LENGTH,
				opTotalMinted
			);
			localFnPtrs_.insertOpPtr(
				LOCAL_OP_NUMBER_MINTED - ALL_STANDARD_OPS_LENGTH,
				opNumberMinted
			);
			localFnPtrs_.insertOpPtr(
				LOCAL_OP_NUMBER_BURNED - ALL_STANDARD_OPS_LENGTH,
				opNumberBurned
			);
		}
	}

	function fnPtrs() public pure override returns (bytes memory) {
		return bytes.concat(AllStandardOps.fnPtrs(), localFnPtrs());
	}

	function withdraw() external {
		require(recipient == msg.sender, "RECIPIENT_ONLY");
		require(amountPayable > 0, "ZERO_FUND");
		amountWithdrawn = amountWithdrawn + amountPayable;
		emit Withdraw(msg.sender, amountPayable, amountWithdrawn);
		amountPayable = 0;

		if (currency == address(0)) Address.sendValue(recipient, amountPayable);
		else IERC20(currency).transfer(recipient, amountPayable);
	}
}
