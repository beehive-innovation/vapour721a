// SPDX-License-Identifier: CAL
pragma solidity =0.8.10;

import "@beehiveinnovation/rain-protocol/contracts/vm/StandardStateBuilder.sol";
import "@beehiveinnovation/rain-protocol/contracts/vm/ops/AllStandardOps.sol";
import "./Vapour721A.sol";

contract Vapour721AStateBuilder is StandardStateBuilder {
	using LibFnPtrs for bytes;

	function localStackPops()
		internal
        pure
        virtual
        override
        returns (uint256[] memory)
	{
		uint256[] memory pops_ = new uint256[](LOCAL_OPS_LENGTH);
		// totalSupplly
		pops_[0] = 0;
		// number minted
        pops_[1] = 0;
		// number minted
        pops_[2] = 1;
		// number burned
        pops_[3] = 1;

        return pops_;
	}

	/// @inheritdoc StandardStateBuilder
    function localStackPushes()
        internal
        pure
        virtual
        override
        returns (uint256[] memory)
    {
        uint256[] memory pushes_ = new uint256[](LOCAL_OPS_LENGTH);
		// totalSupplly
        pushes_[0] = 1;
		// number minted
        pushes_[1] = 1;
		// number minted
        pushes_[2] = 1;
		// number burned
        pushes_[3] = 1;
        return pushes_;
    }
}
