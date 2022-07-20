import { ethers } from "hardhat";
import {
	Rain721A,
	ConstructorConfigStruct,
	InitializeConfigStruct,
	InitializeEvent,
} from "../../typechain/Rain721A";
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
import { config, owner, rain721AFactory, recipient, currency } from "../1_setup";
import { StateConfig, VM } from "rain-sdk";

let rain721aConstructorConfig: ConstructorConfigStruct;
let rain721aInitializeConfig: InitializeConfigStruct;
let rain721a: Rain721A;

describe("Rain721A Initialize test", () => {
	it("Should deploy Rain721A Contract and Initialize", async () => {
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
			currency: currency.address,
		};

		const trx = await rain721AFactory.createChildTyped(
			rain721aConstructorConfig,
			currency.address,
			vmStateConfig
		);
		const child = await getChild(rain721AFactory, trx);

		rain721a = (await ethers.getContractAt("Rain721A", child)) as Rain721A;

		assert(child != ZERO_ADDRESS, "Rain721A Address not find");
		const [config_] = (await getEventArgs(
			trx,
			"Initialize",
			rain721a
		)) as InitializeEvent["args"];
		assert(
			config_.vmStateBuilder == config.allStandardOpsStateBuilder,
			"Wrong stateBuilder address"
		);
		expect(config_.currency).to.equals(currency.address);
	});

	it("SHould fail to initialize again.", async () => {
		await expect(rain721a.initialize(rain721aInitializeConfig)).to.revertedWith(
			"INITIALIZED"
		);
	});

	it("Should be able to Initialize after creating with createChild method", async () => {
		let encodedConfig = ethers.utils.defaultAbiCoder.encode(
			[
				"tuple(string name, string symbol, string baseURI, uint256 supplyLimit, address recipient, address owner)",
			],
			[rain721aConstructorConfig]
		);
		let createTrx = await rain721AFactory.createChild(encodedConfig);

		let child = await getChild(rain721AFactory, createTrx);

		rain721a = (await ethers.getContractAt("Rain721A", child)) as Rain721A;

		let initializeTrx = await rain721a.initialize(rain721aInitializeConfig);

		const [config_] = (await getEventArgs(
			initializeTrx,
			"Initialize",
			rain721a
		)) as InitializeEvent["args"];

		assert(child != ZERO_ADDRESS, "Rain721A Address not find");
		assert(
			config_.vmStateBuilder == config.allStandardOpsStateBuilder,
			"Wrong stateBuilder address"
		);
		expect(config_.currency).to.deep.equals(rain721aInitializeConfig.currency);
	});

	it("Should fain to initialed rain721a contract deployed by createChild method", async () => {
		await expect(rain721a.initialize(rain721aInitializeConfig)).to.revertedWith(
			"INITIALIZED"
		);
	});
});
