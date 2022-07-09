import hre, {ethers} from "hardhat";
import path from "path";
import {fetchFile, writeFile} from "../test/utils";

const sleep = (delay) =>
	new Promise((resolve) => setTimeout(resolve, delay * 1000));

async function main() {
	const blockNumber = (await ethers.provider.getBlock("latest")).number;

	console.log("Deploying smartcontract");
	const Rain721A = await ethers.getContractFactory("Rain721A");
	const rain721A = await Rain721A.deploy();
	await rain721A.deployed();
	console.log("contract deployed : ", rain721A.address);

	const pathExampleConfig = path.resolve(
		__dirname,
		`../config/${hre.network.name}.json`
	);
	const config = JSON.parse(fetchFile(pathExampleConfig));

	config.network = "mumbai";

	config.rain721A = rain721A.address;
	config.rain721ABlock = blockNumber;

	const pathConfigLocal = path.resolve(
		__dirname,
		`../config/${hre.network.name}.json`
	);
	writeFile(pathConfigLocal, JSON.stringify(config, null, 2));

	await sleep(30);

	console.log("Verifying smartcontract");
	await hre.run("verify:verify", {
		address: rain721A.address,
		contract: "contracts/Rain721A.sol:Rain721A",
		constructorArguments: [],
	});
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
