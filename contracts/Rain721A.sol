// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/access/Ownable.sol";
import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@beehiveinnovation/rain-protocol/contracts/vm/RainVM.sol";
import {AllStandardOps} from "@beehiveinnovation/rain-protocol/contracts/vm/ops/AllStandardOps.sol";
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
	uint256 public supplyLimit;

	address private vmStatePointer;
	address public currency;
	address payable public recipient;

	string public baseURI;

	event Construct(ConstructorConfig config_);
	event Initialize(InitializeConfig config_);
	event RecipientChanged(address newRecipient);

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
		require(_totalMinted() + units_ <= supplyLimit, "MAX_LIMIT");
		address account_ = msg.sender;
		bytes memory context_ = new bytes(0x20);
		assembly {
			mstore(add(context_, 0x20), account_)
		}
		State memory state_ = _loadState();
		eval(context_, state_, 0);
		require(state_.stack[0] == 1, "CANT_MINT");
		if (state_.stackIndex > 1) {
			if (state_.stack[1] == 0) {
				Address.sendValue(recipient, state_.stack[2] * units_);
			}
			if (state_.stack[1] == 1) {
				ITransfer(currency).transferFrom(
					msg.sender,
					recipient,
					state_.stack[2] * units_
				);
			}
			if (state_.stack[1] == 2) {
				ITransfer(currency).safeTransferFrom(
					msg.sender,
					recipient,
					state_.stack[2],
					state_.stack[3] * units_,
					""
				);
			}
		}
		_mint(_msgSender(), units_);
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

		if (from == address(0)) require(state_.stack[0] == 1, "CANT MINT");
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
