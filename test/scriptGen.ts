import { ethers } from "ethers";
import { StateConfig, VM } from "rain-sdk";
import { concat, op, Opcode } from "./utils";

/**
 * Method to create a simple time based rule
 * 
 * @param timestamp - the timestamp to set the rule for
 * @param type - type of the check, meaning current timestamp to be gt, gte, lt, lte than the "timestamp"
 * 
 * @returns A @see StateConfig
 */
export const beforeAfterTime = (
    timestamp: number,
    type: "gt" | "lt" | "gte" | "lte"
): StateConfig => {
    let src = new Uint8Array();

    if (type === "gte") {
        timestamp = timestamp === 0 ? 0 : timestamp - 1;
        src = op(Opcode.GREATER_THAN)
    }
    if (type === "lte") {
        timestamp++;
        src = op(Opcode.LESS_THAN)
    }
    if (type === "lt") {
        src = op(Opcode.LESS_THAN)
    }
    if (type === "gt") {
        src = op(Opcode.GREATER_THAN)
    }

    return {
        constants: [timestamp],
        sources: [
            concat([
                op(Opcode.BLOCK_TIMESTAMP),
                op(Opcode.VAL, 0),
                src
            ])
        ],
        stackLength: 10,
        argumentsLength: 0
    };
}

/**
 * Constructs a new canLive config to be used in a Sale contract's canLive functions.
 *
 * @param startTimestamp - Timestamp that will be used in constructor to create a simple timestamp based canLive condition.
 * If the current timestamp is greater than 'startTimestamp' the sale can live (start, i.e. status from Pending to Active).
 * @param endTimestamp - Timestamp that will be used in constructor to create a simple time based canLive condition.
 * If the current timestamp is less than 'endTimestamp' the sale can live or in other words stay Active and if not it can end
 * (i.e status from Active to Success/Fail).
 *
 */
export const betweenTimestamps = (
    startTimestamp: number,
    endTimestamp: number
): StateConfig => ({
    sources: [
        concat([
            op(Opcode.BLOCK_TIMESTAMP),
            op(Opcode.VAL, 0),
            op(Opcode.GREATER_THAN),
            op(Opcode.BLOCK_TIMESTAMP),
            op(Opcode.VAL, 1),
            op(Opcode.LESS_THAN),
            op(Opcode.EVERY, 2),
        ]),
    ],
    constants: [startTimestamp, endTimestamp],
    stackLength: 10,
    argumentsLength: 0
})


/**
 * Method to check if a script is less than another script or not. will return 1 if is true and 0 if it is not
 * 
 * @param config1 - first script
 * @param config2 - second script
 * @param stackReassignment - (optional) pass false if STACK opcode operands dont need to be reassigned to their new 
 * relative positioins in the script. i.e. if the individual scripts' STACK opcodes are refering to any value outside of their own 
 * script scope (refering to other scripts that are being combined). this way the STACK opcode operand will stay untouched when scripts combine
 * @returns a @see StateConfig in VM boolean format (true non-zero, false zero)
 */
export const lt = (config1: StateConfig, config2: StateConfig, stackReassignment: boolean = true): StateConfig => {
    let result_ = VM.combiner(config1, config2);
    result_.sources[0] = concat([
        result_.sources[0],
        op(VM.Opcodes.LESS_THAN)
    ])
    return result_;
}

/**
 * Method to check if an address has any tier status or not, i.e if is in tier contract or not
 * 
 * @param tierConfig - the tier report config @see CombineTierGenerator
 * @param stackReassignment - (optional) pass false if STACK opcode operands dont need to be reassigned to their new 
 * relative positioins in the script. i.e. if the individual scripts' STACK opcodes are refering to any value outside of their own 
 * script scope (refering to other scripts that are being combined). this way the STACK opcode operand will stay untouched when scripts combine
 * @returns a VM script @see StateConfig
 */
export const hasAnyTier = (
    tierConfig: StateConfig,
): StateConfig => {

    const max = {
        sources: [concat([op(Opcode.VAL, 0)])],
        constants: [ethers.constants.MaxUint256],
        stackLength: 10,
        argumentsLength: 0
    }
    return lt(
        tierConfig,
        max
    )
}