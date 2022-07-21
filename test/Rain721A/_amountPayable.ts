import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { StateConfig, VM } from "rain-sdk";
import {
    BuyConfigStruct,
    ConstructorConfigStruct,
    Rain721A,
} from "../../typechain/Rain721A";
import {
    buyer0,
    buyer1,
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
let _supplyLimit: BigNumber
let nftPrice: BigNumber

describe('_amountPayable test', () => {
    before(async () => {
        _supplyLimit = ethers.BigNumber.from(100);
        nftPrice = ethers.utils.parseEther('1');

        const vmStateConfig: StateConfig = {
            sources: [
                concat([
                    op(Opcode.CONSTANT, 1),
                    op(Opcode.CONSTANT, 0)
                ]),
            ],
            constants: [nftPrice, _supplyLimit],
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
    })

    it('should give the correct _amountPayable after a buyer mints.', async () => {
        await currency.connect(buyer0).mintTokens(10)
        await currency.connect(buyer0).approve(rain721a.address, nftPrice.mul(_supplyLimit))

        const units = ethers.BigNumber.from(10)

        const buyConfig: BuyConfigStruct = {
            minimumUnits: units,
            desiredUnits: units,
            maximumPrice: nftPrice,
        };

        await rain721a.connect(buyer0).mintNFT(buyConfig)

        expect(await rain721a.totalSupply()).to.equals(units)

        expect(await rain721a._amountPayable()).to.equals(nftPrice.mul(units))
    })

    it('should give the correct _amountPayable after a second buyer mints.', async () => {

        await currency.connect(buyer1).mintTokens(10)
        await currency.connect(buyer1).approve(rain721a.address, nftPrice.mul(_supplyLimit))

        const units = ethers.BigNumber.from(10)

        const buyConfig: BuyConfigStruct = {
            minimumUnits: units,
            desiredUnits: units,
            maximumPrice: nftPrice,
        };

        await rain721a.connect(buyer1).mintNFT(buyConfig)

        expect(await rain721a.totalSupply()).to.equals(units.add(units))

        expect(await rain721a._amountPayable()).to.equals(nftPrice.mul(units.add(units)))
    })

    it('should give the correct _amountPayable after the recipient withdraws.', async () => {

        await rain721a.connect(recipient).withdraw()

        expect(await rain721a._amountPayable()).to.equals(ethers.BigNumber.from(0))
    })
})