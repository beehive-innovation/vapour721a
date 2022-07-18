import {Rain721AFactory} from "../../typechain/Rain721AFactory";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers} from "hardhat";
import {
	ConstructorConfigStruct,
	InitializeConfigStruct,
} from "../../typechain/Rain721A";
import {concat, getEventArgs, op} from "../utils";
import {checkChildIntegrity} from "./childIntegrity";

import {expect} from "chai";
import {ReserveToken} from "../../typechain/ReserveToken";
import {Token} from "../../typechain/Token";
import {StateConfig, VM} from "rain-sdk";
import {rain721aFactory} from "../1_setup";

export let factoryDeployer: SignerWithAddress,
	signer1: SignerWithAddress,
	signer2: SignerWithAddress,
	recipient_: SignerWithAddress,
	owner_: SignerWithAddress;

let constructorConfig: ConstructorConfigStruct;

let USDT: Token;

before(async () => {
	const signers = await ethers.getSigners();
	factoryDeployer = signers[0];
	signer1 = signers[1];
	signer2 = signers[2];
	recipient_ = signers[3];
	owner_ = signers[4];

	const stableCoins = await ethers.getContractFactory("ReserveToken");

	USDT = (await stableCoins.deploy()) as ReserveToken;
	await USDT.deployed();

	constructorConfig = {
		name: "rain721a",
		symbol: "RAIN721A",
		baseURI: "BASE_URI",
		supplyLimit: 1000,
		recipient: recipient_.address,
		owner: owner_.address,
	};
});

it("Anyone should be able to create child (createChildTyped)", async () => {
	const vmStateConfig: StateConfig = {
		sources: [concat([op(VM.Opcodes.CONSTANT, 0)])],
		constants: [1],
	};

	const createChildTx = await rain721aFactory
		.connect(signer2)
		.createChildTyped(constructorConfig, USDT.address, vmStateConfig);

	const {sender, child} = await getEventArgs(
		createChildTx,
		"NewChild",
		rain721aFactory
	);
	expect(sender).to.equals(rain721aFactory.address);

	await checkChildIntegrity(rain721aFactory, child, constructorConfig);
});
