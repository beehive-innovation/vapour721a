// SPDX-License-Identifier: CAL
pragma solidity =0.8.15;

import "@beehiveinnovation/rain-protocol/contracts/vm/integrity/StandardIntegrity.sol";
import "@beehiveinnovation/rain-protocol/contracts/vm/ops/AllStandardOps.sol";
import "@beehiveinnovation/rain-protocol/contracts/type/LibCast.sol";
import "./Vapour721A.sol";

contract Vapour721AIntegrity is StandardIntegrity {
	using LibCast for function(uint256) pure returns (uint256)[];
	using LibIntegrityState for IntegrityState;

	function integrityTotalSupply(
		IntegrityState memory integrityState_,
		Operand,
		StackTop stackTop_
	) internal pure returns (StackTop) {
		integrityState_.scratch |= TRACKING_FLAG_TOTAL_SUPPLY;
		return integrityState_.push(stackTop_);
	}

	function integrityTotalMinted(
		IntegrityState memory integrityState_,
		Operand,
		StackTop stackTop_
	) internal pure returns (StackTop) {
		integrityState_.scratch |= TRACKING_FLAG_TOTAL_MINTED;
		return integrityState_.push(stackTop_);

	}

	function integrityNumberMinted(
		IntegrityState memory integrityState_,
		Operand,
		StackTop stackTop_
	) internal pure returns (StackTop) {
		integrityState_.scratch |= TRACKING_FLAG_NUMBER_MINTED;
		function(uint256) internal view returns (uint256) fn_;
		return integrityState_.applyFn(stackTop_, fn_);
	}

	function integrityNumberBurned(
		IntegrityState memory integrityState_,
		Operand,
		StackTop stackTop_
	) internal pure returns (StackTop) {
		integrityState_.scratch |= TRACKING_FLAG_NUMBER_BURNED;
		function(uint256) internal view returns (uint256) fn_;
		return integrityState_.applyFn(stackTop_, fn_);
	}

	function localIntegrityFunctionPointers()
		internal
		pure
		virtual
		override
		returns (
			function(IntegrityState memory, Operand, StackTop)
				view
				returns (StackTop)[]
				memory
		)
	{
		function(IntegrityState memory, Operand, StackTop) view returns (StackTop)[]
			memory localIntegrityFunctionPointers_ = new function(
				IntegrityState memory,
				Operand,
				StackTop
			) view returns (StackTop)[](LOCAL_OPS_LENGTH);

		localIntegrityFunctionPointers_[0] = integrityTotalSupply;
		localIntegrityFunctionPointers_[1] = integrityTotalMinted;
		localIntegrityFunctionPointers_[2] = integrityNumberMinted;
		localIntegrityFunctionPointers_[3] = integrityNumberBurned;

		return localIntegrityFunctionPointers_;
	}
}
