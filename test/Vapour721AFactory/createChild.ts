import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers} from "hardhat";
import {InitializeConfigStruct} from "../../typechain/Vapour721A";
import {concat, eighteenZeros, getEventArgs, op, ZERO_ADDRESS} from "../utils";
import {checkChildIntegrity} from "./childIntegrity";
import {NewChildEvent} from "../../typechain/Vapour721AFactory";

import {expect} from "chai";
import {vapour721AFactory} from "../1_setup";
import {StateConfig, VM} from "rain-sdk";

export let factoryDeployer: SignerWithAddress,
	signer1: SignerWithAddress,
	signer2: SignerWithAddress,
	recipient_: SignerWithAddress,
	owner_: SignerWithAddress;

let initializeConfig: InitializeConfigStruct;

let encodedConfig: string;

before(async () => {
	const signers = await ethers.getSigners();
	factoryDeployer = signers[0];
	signer1 = signers[1];
	signer2 = signers[2];
	recipient_ = signers[3];
	owner_ = signers[4];

	const vmStateConfig: StateConfig = {
		sources: [concat([op(VM.Opcodes.CONSTANT, 0), op(VM.Opcodes.CONSTANT, 1)])],
		constants: [200, ethers.BigNumber.from("1" + eighteenZeros)],
	};

	initializeConfig = {
		name: "vapour721A",
		symbol: "VAPOUR721A",
		baseURI: "BASE_URI",
		supplyLimit: 1000,
		recipient: recipient_.address,
		owner: owner_.address,
		royaltyBPS: 1000,
		admin: signer1.address,
		currency: ZERO_ADDRESS,
		vmStateConfig: vmStateConfig,
	};

	encodedConfig = ethers.utils.defaultAbiCoder.encode(
		[
			"tuple(string name, string symbol, string baseURI, uint256 supplyLimit, address recipient, address owner, address admin, uint256 royaltyBPS, address currency, tuple(bytes[] sources, uint256[] constants) vmStateConfig)",
		],
		[initializeConfig]
	);
});

it("Anyone should be able to create child (createChild)", async () => {
	const createChildTx = await vapour721AFactory
		.connect(signer1)
		.createChild(encodedConfig);

	const {sender, child} = (await getEventArgs(
		createChildTx,
		"NewChild",
		vapour721AFactory
	)) as NewChildEvent["args"];

	expect(sender).to.equals(signer1.address);

	await checkChildIntegrity(vapour721AFactory, child, initializeConfig);
});
