import hre, {ethers} from "hardhat";
import path from "path";
import {fetchFile, writeFile} from "../test/utils";

const sleep = (delay) =>
	new Promise((resolve) => setTimeout(resolve, delay * 1000));

async function main() {
	const blockNumber = (await ethers.provider.getBlock("latest")).number;

	console.log("Deploying stateBuilder");
	const Rain721AStateBuilder = await ethers.getContractFactory("Rain721AStateBuilder");
	const rain721AStateBuilder = await Rain721AStateBuilder.deploy();
	await rain721AStateBuilder.deployed();
	console.log("contract deployed : ", rain721AStateBuilder.address);

	const pathExampleConfig = path.resolve(
		__dirname,
		`../config/${hre.network.name}.json`
	);
	const config = JSON.parse(fetchFile(pathExampleConfig));

	config.network = hre.network.name;

	config.rain721aStateBuilder = rain721AStateBuilder.address;

	const pathConfigLocal = path.resolve(
		__dirname,
		`../config/${hre.network.name}.json`
	);
	writeFile(pathConfigLocal, JSON.stringify(config, null, 2));

	await sleep(30);

	console.log("Verifying smartContract");
	await hre.run("verify:verify", {
		address: rain721AStateBuilder.address,
		contract: "contracts/Rain721AStateBuilder.sol:Rain721AStateBuilder",
		constructorArguments: [],
	});
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
