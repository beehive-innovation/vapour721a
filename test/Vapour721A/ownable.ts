import { ethers } from "hardhat";
import {
	Vapour721A,
	
	InitializeConfigStruct,
	OwnershipTransferredEvent,
} from "../../typechain/Vapour721A";
import { concat, getChild, op } from "../utils";
import { VM } from "rain-sdk";
import { expect } from "chai";
import {
	buyer0,
	config,
	owner,
	vapour721AFactory,
	recipient,
	currency,
} from "../1_setup";
import { StateConfig } from "rain-sdk";

let vapour721AInitializeConfig: InitializeConfigStruct;
let vapour721A: Vapour721A;

describe("Vapour721A Ownable test", () => {
	before(async () => {
		const vmStateConfig: StateConfig = {
			sources: [concat([op(VM.Opcodes.CONSTANT, 0)])],
			constants: [1],
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
			vmStateConfig: vmStateConfig,
			currency: currency.address,
		};

		const deployTrx = await vapour721AFactory.createChildTyped(
			vapour721AInitializeConfig
		);
		const child = await getChild(vapour721AFactory, deployTrx);

		vapour721A = (await ethers.getContractAt("Vapour721A", child)) as Vapour721A;
	});

	it("Should be the correct owner", async () => {
		expect(await await vapour721A.owner()).to.equals(
			vapour721AInitializeConfig.owner
		);
	});

	it("Should fail to change owner with non-Owner address", async () => {
		await expect(
			vapour721A.connect(buyer0).transferOwnership(recipient.address)
		).to.revertedWith("Ownable: caller is not the owner");
	});

	it("Should able to change the owner", async () => {
		const trx = await vapour721A
			.connect(owner)
			.transferOwnership(recipient.address);

		expect(await vapour721A.owner()).to.equals(recipient.address);
	});
});
