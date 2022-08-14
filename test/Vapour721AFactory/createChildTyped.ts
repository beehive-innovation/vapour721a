
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers} from "hardhat";
import {concat, getEventArgs, op, Opcode} from "../utils";
import {checkChildIntegrity} from "./childIntegrity";
import {expect} from "chai";
import {ReserveToken} from "../../typechain/ReserveToken";
import {Token} from "../../typechain/Token";
import {StateConfig, VM} from "rain-sdk";
import {vapour721AFactory} from "../1_setup";
import { InitializeConfigStruct } from "../../typechain/Vapour721A";
import { NewChildEvent } from "../../typechain/Vapour721AFactory";

export let factoryDeployer: SignerWithAddress,
	signer1: SignerWithAddress,
	signer2: SignerWithAddress,
	recipient_: SignerWithAddress,
	owner_: SignerWithAddress;

let initializeConfig: InitializeConfigStruct;

let currency: Token;
before(async () => {
	const signers = await ethers.getSigners();
	factoryDeployer = signers[0];
	signer1 = signers[1];
	signer2 = signers[2];
	recipient_ = signers[3];
	owner_ = signers[4];

	const tokenFactory = await ethers.getContractFactory("ReserveToken");

	currency = (await tokenFactory.deploy()) as ReserveToken;
	await currency.deployed();
});

it("should allow anyone to create a child (createChildTyped)", async () => {
	const vmStateConfig: StateConfig = {
		sources: [concat([op(Opcode.VAL, 0)])],
		constants: [1],
		stackLength: 1,
		argumentsLength: 0
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
		currency: currency.address,
		vmStateConfig: vmStateConfig,
	};
});

