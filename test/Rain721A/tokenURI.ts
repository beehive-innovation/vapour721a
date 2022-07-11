import {expect} from "chai";
import {ethers} from "hardhat";
import {StateConfig, VM} from "rain-sdk";
import {
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
	rain721aFactory,
	recipient,
	rTKN,
} from "../1_setup";
import {concat, eighteenZeros, getChild, op} from "../utils";

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

		rain721aInitializeConfig = {
			vmStateBuilder: config.allStandardOpsStateBuilder,
			vmStateConfig: vmStateConfig,
			currency: rTKN.address,
		};

		const deployTrx = await rain721aFactory.createChildTyped(
			rain721aConstructorConfig,
			rain721aInitializeConfig
		);
		const child = await getChild(rain721aFactory, deployTrx);
		rain721a = (await ethers.getContractAt("Rain721A", child)) as Rain721A;

		await rTKN.connect(buyer0).mintTokens(100);
		await rTKN.connect(buyer1).mintTokens(100);
		await rTKN.connect(buyer2).mintTokens(100);
		await rTKN.connect(buyer3).mintTokens(100);
		await rTKN.connect(buyer4).mintTokens(100);
		await rTKN.connect(buyer5).mintTokens(100);
		await rTKN.connect(buyer6).mintTokens(100);
		await rTKN.connect(buyer7).mintTokens(100);

		await rTKN
			.connect(buyer0)
			.approve(rain721a.address, ethers.BigNumber.from("100" + eighteenZeros));
		await rTKN
			.connect(buyer1)
			.approve(rain721a.address, ethers.BigNumber.from("100" + eighteenZeros));
		await rTKN
			.connect(buyer2)
			.approve(rain721a.address, ethers.BigNumber.from("100" + eighteenZeros));
		await rTKN
			.connect(buyer3)
			.approve(rain721a.address, ethers.BigNumber.from("100" + eighteenZeros));
		await rTKN
			.connect(buyer4)
			.approve(rain721a.address, ethers.BigNumber.from("100" + eighteenZeros));
		await rTKN
			.connect(buyer5)
			.approve(rain721a.address, ethers.BigNumber.from("100" + eighteenZeros));
		await rTKN
			.connect(buyer6)
			.approve(rain721a.address, ethers.BigNumber.from("100" + eighteenZeros));
		await rTKN
			.connect(buyer7)
			.approve(rain721a.address, ethers.BigNumber.from("100" + eighteenZeros));

		await rain721a.connect(buyer0).mintNFT(100);
		await rain721a.connect(buyer1).mintNFT(100);
		await rain721a.connect(buyer2).mintNFT(100);
		await rain721a.connect(buyer3).mintNFT(100);
		await rain721a.connect(buyer4).mintNFT(100);
		await rain721a.connect(buyer5).mintNFT(100);
		await rain721a.connect(buyer6).mintNFT(100);
		await rain721a.connect(buyer7).mintNFT(100);

		expect(await rain721a.totalSupply()).to.equals(
			rain721aConstructorConfig.supplyLimit
		);
	});

	it("Should retrun correct tokenURI", async () => {
		for (let i = 1; i <= 5; i++)
			expect(await rain721a.tokenURI(i)).to.equals(
				`${rain721aConstructorConfig.baseURI}/${i}.json`
			);
	});
});
