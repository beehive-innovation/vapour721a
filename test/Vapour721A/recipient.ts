import {expect} from "chai";
import {ethers} from "hardhat";
import {StateConfig, VM} from "rain-sdk";
import {
	InitializeConfigStruct,
	Vapour721A,
	InitializeEvent
} from "../../typechain/Vapour721A";
import {
	buyer0,
	buyer1,
	buyer7,
	config,
	owner,
	vapour721AFactory,
	recipient,
	currency,
} from "../1_setup";
import {
	concat,
	getChild,
	getEventArgs,
	op,
	Opcode,
	ZERO_ADDRESS,
} from "../utils";

let vapour721AInitializeConfig: InitializeConfigStruct;
let vapour721A: Vapour721A;

describe("Vapour721A recipient test", () => {
	before(async () => {
		const vmStateConfig: StateConfig = {
			sources: [concat([op(Opcode.VAL, 0)])],
			constants: [1],
			stackLength: 2,
			argumentsLength: 0,
		};

	});

	it("Should set the correct recipient", async () => {
		const vmStateConfig: StateConfig = {
			sources: [concat([op(Opcode.VAL, 0)])],
			constants: [1],
			stackLength: 2,
			argumentsLength: 0
		};

		vapour721AInitializeConfig = {
			name: "nft",
			symbol: "NFT",
			baseURI: "BASE_URI",
			supplyLimit: 36,
			recipient: recipient.address,
			owner: owner.address,
			royaltyBPS: 1000,
			admin: buyer0.address,
			currency: currency.address,
			vmStateConfig: vmStateConfig

		};
	});

	it("Should set the correct recipient", async () => {
		const vmStateConfig: StateConfig = {
			sources: [concat([op(Opcode.VAL, 0)])],
			constants: [1],
			stackLength: 2,
			argumentsLength: 0,
		};

		const deployTrx = await vapour721AFactory.createChildTyped(
			vapour721AInitializeConfig
		);
		const child = await getChild(vapour721AFactory, deployTrx);

		vapour721A = (await ethers.getContractAt(
			"Vapour721A",
			child
		)) as Vapour721A;

		const [config_] = (await getEventArgs(
			deployTrx,
			"Initialize",
			vapour721A
		)) as InitializeEvent["args"];

		expect(config_.recipient).to.equals(vapour721AInitializeConfig.recipient);
	});

	it("Should fail to change recipient by non-recipient user", async () => {
		await expect(
			vapour721A.connect(buyer7).setRecipient(buyer1.address)
		).to.revertedWith("RECIPIENT_ONLY");
	});

	it("Should fail to change recipient to ZEROADDRESS", async () => {
		await expect(
			vapour721A.connect(recipient).setRecipient(ZERO_ADDRESS)
		).to.revertedWith("INVALID_ADDRESS");
	});

	it("Should fail to change recipient to contract address", async () => {
		await expect(
			vapour721A.connect(recipient).setRecipient(currency.address)
		).to.revertedWith("INVALID_ADDRESS");
	});
});
