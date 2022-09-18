// SPDX-License-Identifier: CAL
pragma solidity =0.8.15;

import {Factory} from "@beehiveinnovation/rain-protocol/contracts/factory/Factory.sol";
import "./Vapour721A.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

contract Vapour721AFactory is Factory {
	address private immutable implementation;

	constructor(address vmIntegrity) {
		address implementation_ = address(new Vapour721A(vmIntegrity));
		emit Implementation(msg.sender, implementation_);
		implementation = implementation_;
	}

	function _createChild(bytes memory data_)
		internal
		virtual
		override
		returns (address)
	{
		InitializeConfig memory config_ = abi.decode(data_, (InitializeConfig));
		address clone_ = Clones.clone(implementation);
		Vapour721A(clone_).initialize(config_); 
		return clone_;
	}

	/// Typed wrapper around IFactory.createChild.
	function createChildTyped(InitializeConfig calldata initializeConfig_)
		external
		returns (Vapour721A)
	{
		return Vapour721A(createChild(abi.encode(initializeConfig_)));
	}
}
