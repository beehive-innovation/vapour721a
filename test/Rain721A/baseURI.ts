import { expect } from "chai";
import { ethers } from "hardhat";
import { StateConfig, VM } from "rain-sdk";
import {
    BuyConfigStruct,
    ConstructorConfigStruct,
    Rain721A,
} from "../../typechain/Rain721A";
import {
    buyer0,
    owner,
    rain721AFactory,
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
} from "../utils";

let rain721aConstructorConfig: ConstructorConfigStruct;
let rain721a: Rain721A;

describe('baseURI test', () => {
    it('should give the correct baseURI after construction.', async () => {
        const _supplyLimit = ethers.BigNumber.from(100);
        const vmStateConfig: StateConfig = {
            sources: [
                concat([op(Opcode.CONSTANT, 0), op(Opcode.CONSTANT, 1)]),
            ],
            constants: [200, ethers.BigNumber.from("1" + eighteenZeros)],
        };

        rain721aConstructorConfig = {
            name: "nft",
            symbol: "NFT",
            baseURI: "baseURI",
            supplyLimit: _supplyLimit,
            recipient: recipient.address,
            owner: owner.address,
        };

        const deployTrx = await rain721AFactory.createChildTyped(
            rain721aConstructorConfig,
            currency.address,
            vmStateConfig
        );
        const child = await getChild(rain721AFactory, deployTrx);
        rain721a = (await ethers.getContractAt("Rain721A", child)) as Rain721A;

        expect(await rain721a.baseURI()).to.equals(rain721aConstructorConfig.baseURI)
    })
})