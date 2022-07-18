import hre, {ethers} from "hardhat";
import path from "path";
import {fetchFile, writeFile} from "../test/utils";

const sleep = (delay) =>
	new Promise((resolve) => setTimeout(resolve, delay * 1000));

async function main() {

    const blockNumber = await ethers.provider.getBlockNumber();
	const pathExampleConfig = path.resolve(
		__dirname,
		`../config/${hre.network.name}.json`
	);
	const config = JSON.parse(fetchFile(pathExampleConfig));

	console.log("Deploying rain721a factory");
	const Rain721aFactory = await ethers.getContractFactory("Rain721AFactory");
	const rain721AFactory = await Rain721aFactory.deploy(config.rain721aStateBuilder);
	await rain721AFactory.deployed();
	console.log("contract deployed : ", rain721AFactory.address);


	config.rain721aFactory = rain721AFactory.address;
	config.rain721aFactoryBlock = blockNumber;

	const pathConfigLocal = path.resolve(
		__dirname,
		`../config/${hre.network.name}.json`
	);

	writeFile(pathConfigLocal, JSON.stringify(config, null, 2));

	await sleep(30);

	console.log("Verifying smartContract");
	await hre.run("verify:verify", {
		address: rain721AFactory.address,
		contract: "contracts/Rain721AFactory.sol:Rain721AFactory",
		constructorArguments: [config.rain721aStateBuilder],
	});
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
