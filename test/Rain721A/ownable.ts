import {ethers} from "hardhat";
import {
	Rain721A,
	ConstructorConfigStruct,
	InitializeConfigStruct,
	OwnershipTransferredEvent,
} from "../../typechain/Rain721A";
import {concat, eighteenZeros, getChild, op} from "../utils";
import {VM} from "rain-sdk";
import {expect} from "chai";
import {
	buyer0,
	config,
	owner,
	rain721aFactory,
	recipient,
	rTKN,
} from "../1_setup";
import {StateConfig} from "rain-sdk";

let rain721aConstructorConfig: ConstructorConfigStruct;
let rain721aInitializeConfig: InitializeConfigStruct;
let rain721a: Rain721A;

describe("Rain721A Ownable test", () => {
	before(async () => {
		const vmStateConfig: StateConfig = {
			sources: [concat([op(VM.Opcodes.CONSTANT, 0)])],
			constants: [1],
		};

		rain721aConstructorConfig = {
			name: "nft",
			symbol: "NFT",
			baseURI: "BASE_URI",
			supplyLimit: 36,
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
	});

	it("Should be the correct owner", async () => {
		expect(await await rain721a.owner()).to.equals(
			rain721aConstructorConfig.owner
		);
	});

	it("Should fail to change owner with non-Owner address", async () => {
		await expect(
			rain721a.connect(buyer0).transferOwnership(recipient.address)
		).to.revertedWith("Ownable: caller is not the owner");
	});

	it("Should able to change the owner", async () => {
		const trx = await rain721a
			.connect(owner)
			.transferOwnership(recipient.address);

		expect(await rain721a.owner()).to.equals(recipient.address);
	});
});
