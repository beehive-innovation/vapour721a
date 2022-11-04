import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import hre, { ethers } from "hardhat";
import path from "path";
import {
	Vapour721A,
} from "../typechain/Vapour721A";
import { Vapour721AFactory, ImplementationEvent } from "../typechain/Vapour721AFactory";
import { Token } from "../typechain/Token";
import { fetchFile, getEventArgs, writeFile } from "./utils";
import { expect } from "chai";

export let vapour721AFactory: Vapour721AFactory;
export let vapour721A: Vapour721A;
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

	const Vapour721AFactory = await ethers.getContractFactory("Vapour721AFactory");
	vapour721AFactory = (await Vapour721AFactory.deploy()) as Vapour721AFactory;
	await vapour721AFactory.deployed();

	const [sender, implementation] = await getEventArgs(vapour721AFactory.deployTransaction, "Implementation", vapour721AFactory) as ImplementationEvent["args"];

	expect(sender).to.not.null;
	expect(implementation).to.not.null;

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

	const pathConfigLocal = path.resolve(
		__dirname,
		`../config/test/${hre.network.name}.json`
	);
	writeFile(pathConfigLocal, JSON.stringify(config, null, 2));
});
