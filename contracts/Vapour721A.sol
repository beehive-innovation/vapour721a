// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "erc721a/contracts/ERC721A.sol";
import "@beehiveinnovation/rain-protocol/contracts/math/FixedPointMath.sol";
import "@beehiveinnovation/rain-protocol/contracts/vm/RainVM.sol";
import "@beehiveinnovation/rain-protocol/contracts/vm/ops/AllStandardOps.sol";
import "@beehiveinnovation/rain-protocol/contracts/vm/VMStateBuilder.sol";
import "hardhat/console.sol";

/**
 * config for deploying Vapour721A contract
 */
struct ConstructorConfig {
	string name;
	string symbol;
	string baseURI;
	uint256 supplyLimit;
	address recipient;
	address owner;
	uint256 royaltyBPS;
}

/**
config for Initializing VMstateConfig
 */

struct InitializeConfig {
	address currency;
	address vmStateBuilder;
	StateConfig vmStateConfig;
}

struct BuyConfig {
	uint256 maximumPrice;
	uint256 minimumUnits;
	uint256 desiredUnits;
}

uint256 constant STORAGE_OPCODES_LENGTH = 3;

// the total numbers of tokens
uint256 constant LOCAL_OP_TOTAL_SUPPLY = ALL_STANDARD_OPS_LENGTH;
// the total unites minted
uint256 constant LOCAL_OP_TOTAL_MINTED = LOCAL_OP_TOTAL_SUPPLY + 1;
// number of tokens minted by `owner`.
uint256 constant LOCAL_OP_NUMBER_MINTED = LOCAL_OP_TOTAL_MINTED + 1;
// number of tokens burned by `owner`.
uint256 constant LOCAL_OP_NUMBER_BURNED = LOCAL_OP_NUMBER_MINTED + 1;

uint256 constant LOCAL_OPS_LENGTH = 4;

contract Vapour721A is ERC721A, RainVM, Ownable {
	using Strings for uint256;
	using Math for uint256;
	using LibFnPtrs for bytes;
	using FixedPointMath for uint256;

	// storage variables
	uint256 public _supplyLimit;
	uint256 private _amountWithdrawn;
	uint256 public _amountPayable;

	address private _vmStatePointer;
	address public _currency;
	address public _recipient;

	// Royalty amount in bps
	uint256 private _royaltyBPS;

	string public baseURI;

	event Construct(ConstructorConfig config_);
	event Initialize(InitializeConfig config_);
	event RecipientChanged(address newRecipient);
	event Withdraw(
		address _withdrawer,
		uint256 _amountWithdrawn,
		uint256 _totalWithdrawn
	);

	constructor(ConstructorConfig memory config_)
		ERC721A(config_.name, config_.symbol)
	{
		_supplyLimit = config_.supplyLimit;
		baseURI = config_.baseURI;

		_royaltyBPS = config_.royaltyBPS;
		require(_royaltyBPS < 10_000, "MAX_ROYALTY");

		setRecipient(config_.recipient);
		transferOwnership(config_.owner);

		emit Construct(config_);
	}

	function initialize(InitializeConfig memory config_) external {
		require(_vmStatePointer == address(0), "INITIALIZED");

		_currency = config_.currency;

		Bounds memory vmScript;
		vmScript.entrypoint = 0;
		Bounds[] memory boundss_ = new Bounds[](1);
		boundss_[0] = vmScript;
		bytes memory vmStateBytes_ = VMStateBuilder(config_.vmStateBuilder)
			.buildState(address(this), config_.vmStateConfig, boundss_);
		_vmStatePointer = SSTORE2.write(vmStateBytes_);

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
			slot_ := _supplyLimit.slot
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
		return LibState.fromBytesPacked(SSTORE2.read(_vmStatePointer));
	}

	function calculateBuy(address account_, uint256 targetUnits_)
		public
		view
		returns (uint256 maxUnits_, uint256 price_)
	{
		require(_vmStatePointer != address(0), "NOT_INITIALIZED");
		State memory state_ = _loadState();

		bytes memory context_ = new bytes(0x40);
		assembly {
			mstore(add(context_, 0x20), account_)
			mstore(add(add(context_, 0x20), 0x20), targetUnits_)
		}

		eval(context_, state_, 0);

		(maxUnits_, price_) = (
			state_.stack[state_.stackIndex - 2],
			state_.stack[state_.stackIndex - 1]
		);
	}

	function mintNFT(BuyConfig calldata config_) external {
		require(0 < config_.minimumUnits, "0_MINIMUM");
		require(
			config_.minimumUnits <= config_.desiredUnits,
			"MINIMUM_OVER_DESIRED"
		);

		uint256 remainingUnits_ = _supplyLimit - _totalMinted();
		uint256 targetUnits_ = config_.desiredUnits.min(remainingUnits_);

		(uint256 maxUnits_, uint256 price_) = calculateBuy(
			msg.sender,
			targetUnits_
		);

		uint256 units_ = maxUnits_.min(targetUnits_);
		require(units_ >= config_.minimumUnits, "INSUFFICIENT_STOCK");

		require(price_ <= config_.maximumPrice, "MAXIMUM_PRICE");
		uint256 cost_ = price_ * units_;
		IERC20(_currency).transferFrom(msg.sender, address(this), cost_);

		_amountPayable = _amountPayable + cost_;
		_mint(msg.sender, units_);
	}

	function setRecipient(address newRecipient) public {
		require(
			msg.sender == _recipient || _recipient == address(0),
			"RECIPIENT_ONLY"
		);
		require(
			newRecipient.code.length == 0 && newRecipient != address(0),
			"INVALID_ADDRESS."
		);
		_recipient = payable(newRecipient);
		emit RecipientChanged(newRecipient);
	}

	function opTotalSupply(uint256, uint256 stackTopLocation_)
		internal
		view
		returns (uint256)
	{
		uint256 totalSupply_ = totalSupply();
		assembly {
			mstore(stackTopLocation_, totalSupply_)
			stackTopLocation_ := add(stackTopLocation_, 0x20)
		}
		return stackTopLocation_;
	}

	function opTotalMinted(uint256, uint256 stackTopLocation_)
		internal
		view
		returns (uint256)
	{
		uint256 totalMinted_ = _totalMinted();
		assembly {
			mstore(stackTopLocation_, totalMinted_)
			stackTopLocation_ := add(stackTopLocation_, 0x20)
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
		uint256 totalMinted_ = _numberMinted(address(uint160(account_)));
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
		uint256 totalMinted_ = _numberBurned(address(uint160(account_)));
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

	function burn(uint256 tokenId) external {
		_burn(tokenId, true);
	}

	function withdraw() external {
		require(_recipient == msg.sender, "RECIPIENT_ONLY");
		require(_amountPayable > 0, "ZERO_FUND");
		_amountWithdrawn = _amountWithdrawn + _amountPayable;
		emit Withdraw(msg.sender, _amountPayable, _amountWithdrawn);
		IERC20(_currency).transfer(_recipient, _amountPayable);
		_amountPayable = 0;
	}

	//// @dev Get royalty information for token
	//// @param _salePrice Sale price for the token
	function royaltyInfo(uint256, uint256 _salePrice)
		external
		view
		returns (address receiver, uint256 royaltyAmount)
	{
		if (_recipient == address(0x0)) {
			return (_recipient, 0);
		}
		return (_recipient, (_salePrice * _royaltyBPS) / 10_000);
	}
}
