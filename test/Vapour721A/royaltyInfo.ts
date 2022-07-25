import { expect } from "chai";
import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { StateConfig } from "rain-sdk";
import {
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
    getEventArgs,
    op,
    Opcode,
} from "../utils";

let vapour721AConstructorConfig: ConstructorConfigStruct;
let vapour721A: Vapour721A;

describe('royaltyInfo test', () => {
    it('shouldnt allow a BPS royalty over 10000', async () => {
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
            supplyLimit: 10,
            recipient: recipient.address,
            owner: owner.address,
            royaltyBPS: 10001,
            admin: buyer0.address
        };

        await expect(vapour721AFactory.createChildTyped(
            vapour721AConstructorConfig,
            currency.address,
            vmStateConfig
        )).revertedWith("MAX_ROYALTY")
    })

    it('should allow a BPS royalty under 10000', async () => {
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
            supplyLimit: 10,
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

        const { config_: { royaltyBPS } } = await getEventArgs(deployTrx, "Construct", vapour721A)
        expect(royaltyBPS).to.equals(1000)
    })

    it('should correctly report royalty and recipient', async () => {
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
            supplyLimit: 10,
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

        const salePrice = parseEther('1')

        const { receiver, royaltyAmount } = await vapour721A.royaltyInfo(1, salePrice)
        const expectedRoyalty = ethers.BigNumber.from(1000).mul(salePrice).div(ethers.BigNumber.from(10000))

        expect(royaltyAmount).to.equals(expectedRoyalty)
        expect(receiver).to.equals(recipient.address)
    })

    it('should correctly report new receiver after changing', async () => {
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
            supplyLimit: 10,
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

        await vapour721A.connect(recipient).setRecipient(buyer1.address)

        const salePrice = parseEther('1')

        const { receiver, royaltyAmount } = await vapour721A.royaltyInfo(1, salePrice)
        const expectedRoyalty = ethers.BigNumber.from(1000).mul(salePrice).div(ethers.BigNumber.from(10000))

        expect(royaltyAmount).to.equals(expectedRoyalty)
        expect(receiver).to.equals(buyer1.address)
    })

    it('should correctly report royalty for any token', async () => {
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
            supplyLimit: 10,
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

        const salePrice = parseEther('1')

        for (let index = 0; index < 50; index++) {
            const { receiver, royaltyAmount } = await vapour721A.royaltyInfo(1 * index, salePrice)
            const expectedRoyalty = ethers.BigNumber.from(1000).mul(salePrice).div(ethers.BigNumber.from(10000))

            expect(royaltyAmount).to.equals(expectedRoyalty)
            expect(receiver).to.equals(recipient.address)
        }
    })
})