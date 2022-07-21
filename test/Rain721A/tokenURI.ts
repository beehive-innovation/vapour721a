import { expect } from "chai";
import { ethers } from "hardhat";
import { StateConfig, VM } from "rain-sdk";
import {
	BuyConfigStruct,
	ConstructorConfigStruct,
	InitializeConfigStruct,
	Rain721A,
} from "../../typechain/Rain721A";
import {
	buyer0,
	buyer1,
	buyer2,
	buyer3,
	buyer4,
	buyer5,
	buyer6,
	buyer7,
	config,
	owner,
	rain721AFactory,
	recipient,
	currency,
} from "../1_setup";
import { concat, eighteenZeros, getChild, op } from "../utils";

let rain721aConstructorConfig: ConstructorConfigStruct;
let rain721aInitializeConfig: InitializeConfigStruct;
let rain721a: Rain721A;

describe("Rain721a tokenURI test", () => {
	before(async () => {
		const vmStateConfig: StateConfig = {
			sources: [
				concat([op(VM.Opcodes.CONSTANT, 0), op(VM.Opcodes.CONSTANT, 1)]),
			],
			constants: [200, ethers.BigNumber.from("1" + eighteenZeros)],
		};

		rain721aConstructorConfig = {
			name: "nft",
			symbol: "NFT",
			baseURI: "BASE_URI",
			supplyLimit: 800,
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
			.approve(rain721a.address, ethers.BigNumber.from("100" + eighteenZeros));
		await currency
			.connect(buyer1)
			.approve(rain721a.address, ethers.BigNumber.from("100" + eighteenZeros));
		await currency
			.connect(buyer2)
			.approve(rain721a.address, ethers.BigNumber.from("100" + eighteenZeros));
		await currency
			.connect(buyer3)
			.approve(rain721a.address, ethers.BigNumber.from("100" + eighteenZeros));
		await currency
			.connect(buyer4)
			.approve(rain721a.address, ethers.BigNumber.from("100" + eighteenZeros));
		await currency
			.connect(buyer5)
			.approve(rain721a.address, ethers.BigNumber.from("100" + eighteenZeros));
		await currency
			.connect(buyer6)
			.approve(rain721a.address, ethers.BigNumber.from("100" + eighteenZeros));
		await currency
			.connect(buyer7)
			.approve(rain721a.address, ethers.BigNumber.from("100" + eighteenZeros));

		const buyConfig: BuyConfigStruct = {
			minimumUnits: 1,
			desiredUnits: 100,
			maximumPrice: ethers.BigNumber.from(100 + eighteenZeros),
		};

		await rain721a.connect(buyer0).mintNFT(buyConfig);
		await rain721a.connect(buyer1).mintNFT(buyConfig);
		await rain721a.connect(buyer2).mintNFT(buyConfig);
		await rain721a.connect(buyer3).mintNFT(buyConfig);
		await rain721a.connect(buyer4).mintNFT(buyConfig);
		await rain721a.connect(buyer5).mintNFT(buyConfig);
		await rain721a.connect(buyer6).mintNFT(buyConfig);
		await rain721a.connect(buyer7).mintNFT(buyConfig);

		expect(await rain721a.totalSupply()).to.equals(
			rain721aConstructorConfig.supplyLimit
		);
	});

	it("Should return correct tokenURI for many tokens", async () => {
		for (let i = 1; i <= 5; i++)
			expect(await rain721a.tokenURI(i)).to.equals(
				`${rain721aConstructorConfig.baseURI}/${i}.json`
			);
	});

	it("Should revert when calling tokenURI() for a non-existent id", async () => {
		await expect(
			rain721a.connect(buyer0).tokenURI(rain721aConstructorConfig.supplyLimit as number + 1)
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
	const vmStateConfig: StateConfig = {
		sources: [
			concat([op(VM.Opcodes.CONSTANT, 0), op(VM.Opcodes.CONSTANT, 1)]),
		],
		constants: [200, ethers.BigNumber.from("1" + eighteenZeros)],
	};

	rain721aConstructorConfig = {
		name: "nft",
		symbol: "NFT",
		baseURI: baseURI,
		supplyLimit: 800,
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

	await currency.connect(buyer0).mintTokens(100);
	await currency
		.connect(buyer0)
		.approve(rain721a.address, ethers.BigNumber.from("100" + eighteenZeros));

	const buyConfig: BuyConfigStruct = {
		minimumUnits: 1,
		desiredUnits: 100,
		maximumPrice: ethers.BigNumber.from(100 + eighteenZeros),
	};

	await rain721a.connect(buyer0).mintNFT(buyConfig);

	return await rain721a.tokenURI(1)
}