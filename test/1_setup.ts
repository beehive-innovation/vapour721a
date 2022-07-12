import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import hre, {ethers} from "hardhat";
import path from "path";
import {Rain721AStateBuilder} from "../typechain/Rain721AStateBuilder";
import {
	ConstructorConfigStruct,
	InitializeConfigStruct,
	Rain721A,
} from "../typechain/Rain721A";
import {Rain721AFactory} from "../typechain/Rain721AFactory";
import {Token} from "../typechain/Token";
import {ReserveTokenERC1155} from "../typechain/ReserveTokenERC1155";
import {fetchFile, writeFile} from "./utils";

export let rain721aFactory: Rain721AFactory;
export let rain721AStateBuilder: Rain721AStateBuilder;
export let rain721a: Rain721A;
export let rain721aConstructorConfig: ConstructorConfigStruct;
export let rain721aInitializeConfig: InitializeConfigStruct;
export let rTKN: Token;
export let gameAsset: ReserveTokenERC1155;
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
	console.log("Setting up environment for Rain721A test");

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

	const Rain721AFactory = await ethers.getContractFactory("Rain721AFactory");
	rain721aFactory = (await Rain721AFactory.deploy()) as Rain721AFactory;
	await rain721aFactory.deployed();

	const Rain721AStateBuilder = await ethers.getContractFactory(
		"Rain721AStateBuilder"
	);
	rain721AStateBuilder =
		(await Rain721AStateBuilder.deploy()) as AllStandardOpsStateBuilder;
	await allStandardOpsStateBuilder.deployed();

	const Erc20 = await ethers.getContractFactory("Token");

	rTKN = (await Erc20.deploy("Rain Token", "rTKN")) as Token;
	await rTKN.deployed();

	const Erc1155 = await ethers.getContractFactory("ReserveTokenERC1155");

	gameAsset = (await Erc1155.deploy()) as ReserveTokenERC1155;
	await gameAsset.deployed();

	const pathExampleConfig = path.resolve(
		__dirname,
		`../config/test/${hre.network.name}.json`
	);
	config = JSON.parse(fetchFile(pathExampleConfig));

	config.network = hre.network.name;

	config.rain721aFactory = rain721aFactory.address;
	config.allStandardOpsStateBuilder = allStandardOpsStateBuilder.address;

	const pathConfigLocal = path.resolve(
		__dirname,
		`../config/test/${hre.network.name}.json`
	);
	writeFile(pathConfigLocal, JSON.stringify(config, null, 2));
});
