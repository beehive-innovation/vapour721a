import { expect } from "chai";
import { ethers } from "hardhat";
import { StateConfig, VM } from "rain-sdk";
import {
    BuyConfigStruct,
    ConstructorConfigStruct,
    Vapour721A,
} from "../../typechain/Vapour721A";
import {
    buyer0,
    owner,
    vapour721AFactory,
    recipient,
    currency,
} from "../1_setup";
import {
    concat,
    eighteenZeros,
    getChild,
    op,
    Opcode,
    StorageOpcodes,
    ZERO_ADDRESS,
} from "../utils";

let vapour721AConstructorConfig: ConstructorConfigStruct;
let vapour721A: Vapour721A;

describe('_currency test', () => {
    it('should give the correct _currency after construction.', async () => {
        const _supplyLimit = ethers.BigNumber.from(100);
        const vmStateConfig: StateConfig = {
            sources: [
                concat([op(Opcode.CONSTANT, 0), op(Opcode.CONSTANT, 1)]),
            ],
            constants: [200, ethers.BigNumber.from("1" + eighteenZeros)],
        };

        vapour721AConstructorConfig = {
            name: "nft",
            symbol: "NFT",
            baseURI: "baseURI",
            supplyLimit: _supplyLimit,
            recipient: recipient.address,
            owner: owner.address,
            royaltyBPS: 1000,
            admin: buyer0.address
        };

        const deployTrx = await vapour721AFactory.createChildTyped(
            vapour721AConstructorConfig,
            currency.address,
            vmStateConfig
        );
        const child = await getChild(vapour721AFactory, deployTrx);
        vapour721A = (await ethers.getContractAt("Vapour721A", child)) as Vapour721A;

        expect(await vapour721A._currency()).to.equals(currency.address)
    });

    it('should give the native Token _currency', async () => {
        const _supplyLimit = ethers.BigNumber.from(100);
        const vmStateConfig: StateConfig = {
            sources: [
                concat([op(Opcode.CONSTANT, 0), op(Opcode.CONSTANT, 1)]),
            ],
            constants: [200, ethers.BigNumber.from("1" + eighteenZeros)],
        };

        vapour721AConstructorConfig = {
            name: "nft",
            symbol: "NFT",
            baseURI: "baseURI",
            supplyLimit: _supplyLimit,
            recipient: recipient.address,
            owner: owner.address,
            royaltyBPS: 1000,
            admin: buyer0.address
        };

        const deployTrx = await vapour721AFactory.createChildTyped(
            vapour721AConstructorConfig,
            ZERO_ADDRESS,
            vmStateConfig
        );
        const child = await getChild(vapour721AFactory, deployTrx);
        vapour721A = (await ethers.getContractAt("Vapour721A", child)) as Vapour721A;

        expect(await vapour721A._currency()).to.equals(ZERO_ADDRESS)
    });
})