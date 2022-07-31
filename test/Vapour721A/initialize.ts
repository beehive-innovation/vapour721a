import { ethers } from "hardhat";
import {
	Vapour721A,
	InitializeConfigStruct,
	InitializeEvent,
} from "../../typechain/Vapour721A";
import {
	concat,
	eighteenZeros,
	getChild,
	getEventArgs,
	op,
	ZERO_ADDRESS,
} from "../utils";
import { assert } from "console";
import { expect } from "chai";
import { config, owner, vapour721AFactory, recipient, currency, buyer0 } from "../1_setup";
import { StateConfig, VM } from "rain-sdk";

let vapour721AInitializeConfig: InitializeConfigStruct;
let vapour721A: Vapour721A;

describe("Vapour721A Initialize test", () => {
	it("Should deploy Vapour721A contract and initialize", async () => {
		const vmStateConfig: StateConfig = {
			sources: [
				concat([
					op(VM.Opcodes.CONSTANT, 0),
					op(VM.Opcodes.CONSTANT, 1),
					op(VM.Opcodes.CONSTANT, 2),
				]),
			],
			constants: [1, 0, ethers.BigNumber.from("1" + eighteenZeros)],
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

		const trx = await vapour721AFactory.createChildTyped(
			vapour721AInitializeConfig
		);
		const child = await getChild(vapour721AFactory, trx);

		vapour721A = (await ethers.getContractAt("Vapour721A", child)) as Vapour721A;

		assert(child != ZERO_ADDRESS, "Vapour721A Address not found");
		const [config_, vmStateBuilder_] = (await getEventArgs(
			trx,
			"Initialize",
			vapour721A
		)) as InitializeEvent["args"];
		assert(
			vmStateBuilder_ == config.vapour721AStateBuilder,
			"Wrong stateBuilder address"
		);
		expect(config_.currency).to.equals(currency.address);
	});

	it("Should be able to initialize after creating with createChild method", async () => {
		let encodedConfig = ethers.utils.defaultAbiCoder.encode(
			[
				"tuple(string name, string symbol, string baseURI, uint256 supplyLimit, address recipient, address owner, address admin, uint256 royaltyBPS, address currency, tuple(bytes[] sources, uint256[] constants) vmStateConfig)",
			],
			[vapour721AInitializeConfig]
		);
		let createTrx = await vapour721AFactory.createChild(encodedConfig);

		let child = await getChild(vapour721AFactory, createTrx);

		vapour721A = (await ethers.getContractAt("Vapour721A", child)) as Vapour721A;

		const [config_, vmStateBuilder_] = (await getEventArgs(
			createTrx,
			"Initialize",
			vapour721A
		)) as InitializeEvent["args"];

		assert(child != ZERO_ADDRESS, "Vapour721A Address not find");
		assert(
			vmStateBuilder_ == config.vapour721AStateBuilder,
			"Wrong stateBuilder address"
		);
		expect(config_.currency).to.deep.equals(vapour721AInitializeConfig.currency);
	});

	it("Should fail to initialize Vapour721A contract deployed by createChild method", async () => {
		await expect(vapour721A.initialize(vapour721AInitializeConfig, ZERO_ADDRESS)).to.revertedWith(
			"ERC721A__Initializable: contract is already initialized"
		);
	});
});
