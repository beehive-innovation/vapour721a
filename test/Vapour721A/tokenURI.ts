import { expect } from "chai";
import { ethers } from "hardhat";
import { StateConfig, VM } from "rain-sdk";
import {
	BuyConfigStruct,
	
	InitializeConfigStruct,
	StateConfigStruct,
	Vapour721A,
} from "../../typechain/Vapour721A";
import {
	buyer0,
	buyer1,
	buyer2,
	buyer3,
	buyer4,
	buyer5,
	buyer6,
	buyer7,
	owner,
	recipient,
	currency,
	vapour721AFactory,
} from "../1_setup";
import { concat, eighteenZeros, getChild, memoryOperand, MemoryType, op, vapour721AOpcodes } from "../utils";

let vapour721AInitializeConfig: InitializeConfigStruct;
let vapour721A: Vapour721A;

describe("Vapour721A tokenURI test", () => {
	before(async () => {
		const vmStateConfig: StateConfigStruct = {
			sources: [
				concat([op(vapour721AOpcodes.STATE, memoryOperand(MemoryType.Constant, 0)), op(vapour721AOpcodes.STATE, memoryOperand(MemoryType.Constant, 1))]),
			],
			constants: [200, ethers.BigNumber.from("1" + eighteenZeros)],
		};

		vapour721AInitializeConfig = {
			name: "nft",
			symbol: "NFT",
			baseURI: "BASE_URI",
			supplyLimit: 800,
			recipient: recipient.address,
			owner: owner.address,
			royaltyBPS: 1000,
			admin: buyer0.address,
			currency: currency.address,
			vmStateConfig: vmStateConfig
		};

		const deployTrx = await vapour721AFactory.createChildTyped(
			vapour721AInitializeConfig
		);
		const child = await getChild(vapour721AFactory, deployTrx);
		vapour721A = (await ethers.getContractAt("Vapour721A", child)) as Vapour721A;

		await currency.connect(buyer0).mintTokens(100);
		await currency.connect(buyer1).mintTokens(100);
		await currency.connect(buyer2).mintTokens(100);
		await currency.connect(buyer3).mintTokens(100);
		await currency.connect(buyer4).mintTokens(100);
		await currency.connect(buyer5).mintTokens(100);
		await currency.connect(buyer6).mintTokens(100);
		await currency.connect(buyer7).mintTokens(100);

		await currency
			.connect(buyer0)
			.approve(vapour721A.address, ethers.BigNumber.from("100" + eighteenZeros));
		await currency
			.connect(buyer1)
			.approve(vapour721A.address, ethers.BigNumber.from("100" + eighteenZeros));
		await currency
			.connect(buyer2)
			.approve(vapour721A.address, ethers.BigNumber.from("100" + eighteenZeros));
		await currency
			.connect(buyer3)
			.approve(vapour721A.address, ethers.BigNumber.from("100" + eighteenZeros));
		await currency
			.connect(buyer4)
			.approve(vapour721A.address, ethers.BigNumber.from("100" + eighteenZeros));
		await currency
			.connect(buyer5)
			.approve(vapour721A.address, ethers.BigNumber.from("100" + eighteenZeros));
		await currency
			.connect(buyer6)
			.approve(vapour721A.address, ethers.BigNumber.from("100" + eighteenZeros));
		await currency
			.connect(buyer7)
			.approve(vapour721A.address, ethers.BigNumber.from("100" + eighteenZeros));

		const buyConfig: BuyConfigStruct = {
			minimumUnits: 1,
			desiredUnits: 100,
			maximumPrice: ethers.BigNumber.from(100 + eighteenZeros),
		};

		await vapour721A.connect(buyer0).mintNFT(buyConfig);
		await vapour721A.connect(buyer1).mintNFT(buyConfig);
		await vapour721A.connect(buyer2).mintNFT(buyConfig);
		await vapour721A.connect(buyer3).mintNFT(buyConfig);
		await vapour721A.connect(buyer4).mintNFT(buyConfig);
		await vapour721A.connect(buyer5).mintNFT(buyConfig);
		await vapour721A.connect(buyer6).mintNFT(buyConfig);
		await vapour721A.connect(buyer7).mintNFT(buyConfig);

		expect(await vapour721A.totalSupply()).to.equals(
			vapour721AInitializeConfig.supplyLimit
		);
	});

	it("Should return correct tokenURI for many tokens", async () => {
		for (let i = 1; i <= 5; i++)
			expect(await vapour721A.tokenURI(i)).to.equals(
				`${vapour721AInitializeConfig.baseURI}/${i}.json`
			);
	});

	it("Should revert when calling tokenURI() for a non-existent id", async () => {
		await expect(
			vapour721A.connect(buyer0).tokenURI(vapour721AInitializeConfig.supplyLimit as number + 1)
		).revertedWith("URIQueryForNonexistentToken()");
	})

	it("Shouldn't enforce any format when setting baseURI", async () => {
		const baseURIs = ["http://google.com", "ipfs://QmPvjoUdAJVZMVACLqj77wsrQyaJVu9VpKdDRHvFK5cLzR", "Some other string"]

		baseURIs.forEach(async (baseURI) => {
			expect(await deployWithBaseURI(baseURI)).to.equal(`${baseURI}/1.json`);
		})
	})
});

const deployWithBaseURI = async (baseURI: string) => {
	const vmStateConfig: StateConfigStruct = {
		sources: [
			concat([op(vapour721AOpcodes.STATE, memoryOperand(MemoryType.Constant, 0)), op(vapour721AOpcodes.STATE, memoryOperand(MemoryType.Constant, 1))]),
		],
		constants: [200, ethers.BigNumber.from("1" + eighteenZeros)],
	};

	vapour721AInitializeConfig = {
		name: "nft",
		symbol: "NFT",
		baseURI: baseURI,
		supplyLimit: 800,
		recipient: recipient.address,
		owner: owner.address,
		royaltyBPS: 1000,
		admin: buyer0.address,
		currency: currency.address,
		vmStateConfig: vmStateConfig
	};

	const deployTrx = await vapour721AFactory.createChildTyped(
		vapour721AInitializeConfig
	);
	const child = await getChild(vapour721AFactory, deployTrx);
	vapour721A = (await ethers.getContractAt("Vapour721A", child)) as Vapour721A;

	await currency.connect(buyer0).mintTokens(100);
	await currency
		.connect(buyer0)
		.approve(vapour721A.address, ethers.BigNumber.from("100" + eighteenZeros));

	const buyConfig: BuyConfigStruct = {
		minimumUnits: 1,
		desiredUnits: 100,
		maximumPrice: ethers.BigNumber.from(100 + eighteenZeros),
	};

	await vapour721A.connect(buyer0).mintNFT(buyConfig);

	return await vapour721A.tokenURI(1)
}
VM