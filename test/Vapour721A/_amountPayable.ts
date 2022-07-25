import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { StateConfig, VM } from "rain-sdk";
import {
    BuyConfigStruct,
    ConstructorConfigStruct,
    Vapour721A,
} from "../../typechain/Vapour721A";
import {
    buyer0,
    buyer1,
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
} from "../utils";

let vapour721AConstructorConfig: ConstructorConfigStruct;
let vapour721A: Vapour721A;
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
    })

    it('should give the correct _amountPayable after a buyer mints.', async () => {
        await currency.connect(buyer0).mintTokens(10)
        await currency.connect(buyer0).approve(vapour721A.address, nftPrice.mul(_supplyLimit))

        const units = ethers.BigNumber.from(10)

        const buyConfig: BuyConfigStruct = {
            minimumUnits: units,
            desiredUnits: units,
            maximumPrice: nftPrice,
        };

        await vapour721A.connect(buyer0).mintNFT(buyConfig)

        expect(await vapour721A.totalSupply()).to.equals(units)

        expect(await vapour721A._amountPayable()).to.equals(nftPrice.mul(units))
    })

    it('should give the correct _amountPayable after a second buyer mints.', async () => {

        await currency.connect(buyer1).mintTokens(10)
        await currency.connect(buyer1).approve(vapour721A.address, nftPrice.mul(_supplyLimit))

        const units = ethers.BigNumber.from(10)

        const buyConfig: BuyConfigStruct = {
            minimumUnits: units,
            desiredUnits: units,
            maximumPrice: nftPrice,
        };

        await vapour721A.connect(buyer1).mintNFT(buyConfig)

        expect(await vapour721A.totalSupply()).to.equals(units.add(units))

        expect(await vapour721A._amountPayable()).to.equals(nftPrice.mul(units.add(units)))
    })

    it('should give the correct _amountPayable after the recipient withdraws.', async () => {

        await vapour721A.connect(recipient).withdraw()

        expect(await vapour721A._amountPayable()).to.equals(ethers.BigNumber.from(0))
    })
})