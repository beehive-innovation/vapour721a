// SPDX-License-Identifier: CAL
pragma solidity 0.8.10;

import "@beehiveinnovation/rain-protocol/contracts/factory/IFactory.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./Rain721A.sol";

contract Rain721AFactory is IFactory, ReentrancyGuard {
    mapping(address => bool) private contracts;

    function _createChild(bytes calldata data_)
        internal
        returns (address child_)
    {
        ConstructorConfig memory config_ = abi.decode(
            data_,
            (ConstructorConfig)
        );
        child_ = address(new Rain721A(config_));
    }

    /// @inheritdoc IFactory
    function createChild(bytes calldata data_)
        external
        virtual
        override
        nonReentrant
        returns (address)
    {
        // Create child contract using hook.
        address child_ = _createChild(data_);
        // Ensure the child at this address has not previously been deployed.
        require(!contracts[child_], "DUPLICATE_CHILD");
        // Register child contract address to `contracts` mapping.
        contracts[child_] = true;
        // Emit `NewChild` event with child contract address.
        emit IFactory.NewChild(msg.sender, child_);
        return child_;
    }

    /// @inheritdoc IFactory
    function isChild(address maybeChild_)
        external
        view
        virtual
        override
        returns (bool)
    {
        return contracts[maybeChild_];
    }

    /// Typed wrapper around IFactory.createChild.
    function createChildTyped(
        ConstructorConfig calldata constructorConfig_,
        InitializeConfig calldata initializeConfig_
    ) external returns (Rain721A child_) {
        child_ = Rain721A(this.createChild(abi.encode(constructorConfig_)));
        Rain721A(child_).initialize(initializeConfig_);
    }
}
