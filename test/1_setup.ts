import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import hre, { ethers } from "hardhat";
import path from "path";
import { Vapour721AStateBuilder } from "../typechain/Vapour721AStateBuilder";
import {
	ConstructorConfigStruct,
	InitializeConfigStruct,
	Vapour721A,
} from "../typechain/Vapour721A";
import { Vapour721AFactory } from "../typechain/Vapour721AFactory";
import { Token } from "../typechain/Token";
import { fetchFile, writeFile } from "./utils";

export let vapour721AFactory: Vapour721AFactory;
export let vapour721AStateBuilder: Vapour721AStateBuilder;
export let vapour721A: Vapour721A;
export let vapour721AConstructorConfig: ConstructorConfigStruct;
export let vapour721AInitializeConfig: InitializeConfigStruct;
export let currency: Token;
export let recipient: SignerWithAddress,
	owner: SignerWithAddress,
	buyer0: SignerWithAddress,
	buyer1: SignerWithAddress,
	buyer2: SignerWithAddress,
	buyer3: SignerWithAddress,
	buyer4: SignerWithAddress,
	buyer5: SignerWithAddress,
	buyer6: SignerWithAddress,
	buyer7: SignerWithAddress;

export let config;

before(async () => {
	console.log("Setting up environment for Vapour721A test");

	const signers = await ethers.getSigners();
	recipient = signers[0];
	owner = signers[1];
	buyer0 = signers[2];
	buyer1 = signers[3];
	buyer2 = signers[4];
	buyer3 = signers[5];
	buyer4 = signers[6];
	buyer5 = signers[7];
	buyer6 = signers[8];
	buyer7 = signers[9];

	const Vapour721AStateBuilder = await ethers.getContractFactory(
		"Vapour721AStateBuilder"
	);
	vapour721AStateBuilder =
		(await Vapour721AStateBuilder.deploy()) as Vapour721AStateBuilder;
	await vapour721AStateBuilder.deployed();

	const Vapour721AFactory = await ethers.getContractFactory("Vapour721AFactory");
	vapour721AFactory = (await Vapour721AFactory.deploy(
		vapour721AStateBuilder.address
	)) as Vapour721AFactory;
	await vapour721AFactory.deployed();

	const erc20Factory = await ethers.getContractFactory("Token");
	currency = (await erc20Factory.deploy("Vapour Token", "TKN")) as Token;
	await currency.deployed();

	const pathExampleConfig = path.resolve(
		__dirname,
		`../config/test/${hre.network.name}.json`
	);

	config = JSON.parse(fetchFile(pathExampleConfig));

	config.network = hre.network.name;

	config.vapour721AFactory = vapour721AFactory.address;
	config.vapour721AStateBuilder = vapour721AStateBuilder.address;

	const pathConfigLocal = path.resolve(
		__dirname,
		`../config/test/${hre.network.name}.json`
	);
	writeFile(pathConfigLocal, JSON.stringify(config, null, 2));
});
