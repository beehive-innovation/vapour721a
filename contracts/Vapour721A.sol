// SPDX-License-Identifier: MIT
pragma solidity =0.8.15;

import "@beehiveinnovation/rain-protocol/contracts/vm/runtime/StandardVM.sol";
import "@beehiveinnovation/rain-protocol/contracts/vm/runtime/LibStackTop.sol";
import "@beehiveinnovation/rain-protocol/contracts/vm/integrity/RainVMIntegrity.sol";
import "@beehiveinnovation/rain-protocol/contracts/vm/ops/AllStandardOps.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "erc721a-upgradeable/contracts/ERC721AUpgradeable.sol";
import "hardhat/console.sol";

/**
 * config for deploying Vapour721A contract
 */
struct InitializeConfig {
	string name;
	string symbol;
	string baseURI;
	uint256 supplyLimit;
	address recipient;
	address owner;
	address admin;
	uint256 royaltyBPS;
	address currency;
	StateConfig vmStateConfig;
}

struct BuyConfig {
	uint256 maximumPrice;
	uint256 minimumUnits;
	uint256 desiredUnits;
}

struct EvalContext {
	address account;
	uint256 targetUnits;
}

// the total numbers of tokens
uint256 constant TRACKING_FLAG_TOTAL_SUPPLY = 0x1;
// the total unites minted
uint256 constant TRACKING_FLAG_TOTAL_MINTED = 0x2;
// number of tokens minted by `owner`.
uint256 constant TRACKING_FLAG_NUMBER_MINTED = 0x3;
// number of tokens burned by `owner`.
uint256 constant TRACKING_FLAG_NUMBER_BURNED = 0x4;

uint256 constant LOCAL_OPS_LENGTH = 4;

uint256 constant MIN_FINAL_STACK_INDEX = 2;

uint256 constant STORAGE_OPCODES_LENGTH = 3;

library LibEvalContext {
	function toContext(EvalContext memory evalContext_)
		internal
		pure
		returns (uint256[] memory context_)
	{
		context_ = new uint256[](2);
		context_[0] = uint256(uint160(evalContext_.account));
		context_[1] = evalContext_.targetUnits;
	}
}

contract Vapour721A is
	ERC721AUpgradeable,
	StandardVM,
	OwnableUpgradeable,
	AccessControlUpgradeable
{
	using Strings for uint256;
	using Math for uint256;
	using FixedPointMath for uint256;
	using LibEvalContext for EvalContext;
	using LibVMState for VMState;
	using LibVMState for bytes;
	using LibStackTop for StackTop;
	using LibStackTop for uint256[];
	using LibUint256Array for uint256;

	// storage variables
	uint256 private _supplyLimit;
	uint256 private _amountWithdrawn;
	uint256 private _amountPayable;

	address private _currency;
	address payable private _recipient;

	// Royalty amount in bps
	uint256 private _royaltyBPS;

	string private baseURI;

	event Buy(address _receiver, uint256 _units, uint256 _cost);
	event Initialize(InitializeConfig config_);
	event RecipientChanged(address newRecipient);
	event Withdraw(
		address _withdrawer,
		uint256 _amountWithdrawn,
		uint256 _totalWithdrawn
	);

	/// Admin role for `DELEGATED_MINTER`.
	bytes32 private constant DELEGATED_MINTER_ADMIN =
		keccak256("DELEGATED_MINTER_ADMIN");
	/// Role for `DELEGATED_MINTER`.
	bytes32 private constant DELEGATED_MINTER = keccak256("DELEGATED_MINTER");

	constructor(address vmIntegrity_) StandardVM(vmIntegrity_) {}

	function initialize(InitializeConfig memory config_)
		external
		initializerERC721A
		initializer
	{
		__ERC721A_init(config_.name, config_.symbol);
		__Ownable_init();

		_supplyLimit = config_.supplyLimit;
		baseURI = config_.baseURI;

		_royaltyBPS = config_.royaltyBPS;
		require(_royaltyBPS < 10_000, "MAX_ROYALTY");

		setRecipient(config_.recipient);
		transferOwnership(config_.owner);

		require(config_.admin != address(0), "0_ADMIN");
		_setRoleAdmin(DELEGATED_MINTER, DELEGATED_MINTER_ADMIN);

		_grantRole(DELEGATED_MINTER_ADMIN, config_.admin);

		_currency = config_.currency;

		_saveVMState(config_.vmStateConfig, MIN_FINAL_STACK_INDEX.arrayFrom());

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

	function calculateBuy(address account_, uint256 targetUnits_)
		public
		view
		returns (uint256 maxUnits_, uint256 price_)
	{
		require(StandardVM.vmStatePointer != address(0), "NOT_INITIALIZED");
		VMState memory vmState_ = _loadVMState(EvalContext(account_, targetUnits_).toContext());

		(maxUnits_, price_) = vmState_.eval().peek2();
	}

	function _mintNFT(address receiver, BuyConfig memory config_) internal {
		require(0 < config_.minimumUnits, "0_MINIMUM");
		require(
			config_.minimumUnits <= config_.desiredUnits,
			"MINIMUM_OVER_DESIRED"
		);

		uint256 remainingUnits_ = _supplyLimit - _totalMinted();
		uint256 targetUnits_ = config_.desiredUnits.min(remainingUnits_);

		(uint256 maxUnits_, uint256 price_) = calculateBuy(receiver, targetUnits_);

		uint256 units_ = maxUnits_.min(targetUnits_);
		require(units_ >= config_.minimumUnits, "INSUFFICIENT_STOCK");

		require(price_ <= config_.maximumPrice, "MAXIMUM_PRICE");
		uint256 cost_ = price_ * units_;
		if (_currency == address(0)) {
			require(msg.value >= cost_, "INSUFFICIENT_FUND");
			Address.sendValue(payable(msg.sender), msg.value - cost_);
		} else IERC20(_currency).transferFrom(msg.sender, address(this), cost_);

		unchecked {
			_amountPayable = _amountPayable + cost_;
		}
		_mint(receiver, units_);
		emit Buy(receiver, units_, cost_);
	}

	function mintNFT(BuyConfig calldata config_) external payable {
		_mintNFT(msg.sender, config_);
	}

	/// A minting function that allows minting to an address other than the
	/// sender of the transaction/account that pays. This opens up the
	/// possibility of using 3rd party services that will mint on a user's
	/// behalf if they pay with some other form of payment. The BuyConfig for
	/// the mint is split out of its struct, also for easier integration.
	/// The downside is, this way of minting could be vulnerable to a phishing
	/// attack - an attacker could create a duplicate front end that makes the
	/// user think they are minting to themselves, when actually they are
	/// minting to someone else. To mitigate against this we restrict access to
	/// this function to only those accounts with the 'DELEGATED_MINTER' role.
	/// @param receiver the receiver of the NFTs
	/// @param maximumPrice maximum price, as per BuyConfig
	/// @param minimumUnits minimum units, as per BuyConfig
	/// @param desiredUnits desired units, as per BuyConfig
	function mintNFTFor(
		address receiver,
		uint256 maximumPrice,
		uint256 minimumUnits,
		uint256 desiredUnits
	) external payable onlyRole(DELEGATED_MINTER) {
		_mintNFT(receiver, BuyConfig(maximumPrice, minimumUnits, desiredUnits));
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

	function burn(uint256 tokenId) external {
		_burn(tokenId, true);
	}

	function withdraw() external {
		require(_amountPayable > 0, "ZERO_FUND");
		unchecked {
			_amountWithdrawn = _amountWithdrawn + _amountPayable;
		}
		emit Withdraw(msg.sender, _amountPayable, _amountWithdrawn);

		if (_currency == address(0)) Address.sendValue(_recipient, _amountPayable);
		else IERC20(_currency).transfer(_recipient, _amountPayable);

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

	function _opTotalSupply() internal view returns (uint256) {
		return totalSupply();
	}

	function opTotalSupply(
		VMState memory,
		Operand,
		StackTop stackTop_
	) internal view returns (StackTop) {
		return stackTop_.push(_opTotalSupply());
	}

	function _opTotalMinted() internal view returns (uint256) {
		return _totalMinted();
	}

	function opTotalMinted(
		VMState memory,
		Operand,
		StackTop stackTop_
	) internal view returns (StackTop) {
		return stackTop_.push(_opTotalMinted());
	}

	function _opNumberMinted(uint256 account_) internal view returns (uint256) {
		return _numberMinted(address(uint160(account_)));
	}

	function opNumberMinted(
		VMState memory,
		Operand,
		StackTop stackTop_
	) internal view returns (StackTop) {
		return stackTop_.applyFn(_opNumberMinted);
	}

	function _opNumberBurned(uint256 account_) internal view returns (uint256) {
		return _numberBurned(address(uint160(account_)));
	}

	function opNumberBurned(
		VMState memory,
		Operand,
		StackTop stackTop_
	) internal view returns (StackTop) {
		return stackTop_.applyFn(_opNumberBurned);
	}

	function localEvalFunctionPointers()
		internal
		pure
		override
		returns (
			function(VMState memory, Operand, StackTop) view returns (StackTop)[]
				memory localFnPtrs_
		)
	{
		localFnPtrs_ = new function(VMState memory, Operand, StackTop)
			view
			returns (StackTop)[](LOCAL_OPS_LENGTH);
		localFnPtrs_[0] = opTotalSupply;
		localFnPtrs_[1] = opTotalMinted;
		localFnPtrs_[2] = opNumberMinted;
		localFnPtrs_[3] = opNumberBurned;
	}

	function supportsInterface(bytes4 interfaceId)
		public
		view
		override(AccessControlUpgradeable, ERC721AUpgradeable)
		returns (bool)
	{
		return ERC721AUpgradeable.supportsInterface(interfaceId);
	}
}
