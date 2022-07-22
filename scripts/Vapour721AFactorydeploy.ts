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

	console.log("Deploying vapour721A factory");
	const Vapour721AFactory = await ethers.getContractFactory("Vapour721AFactory");
	const vapour721AFactory = await Vapour721AFactory.deploy(config.vapour721AStateBuilder);
	await vapour721AFactory.deployed();
	console.log("contract deployed : ", vapour721AFactory.address);


	config.vapour721AFactory = vapour721AFactory.address;
	config.vapour721AFactoryBlock = blockNumber;

	const pathConfigLocal = path.resolve(
		__dirname,
		`../config/${hre.network.name}.json`
	);

	writeFile(pathConfigLocal, JSON.stringify(config, null, 2));

	await sleep(30);

	console.log("Verifying smartContract");
	await hre.run("verify:verify", {
		address: vapour721AFactory.address,
		contract: "contracts/Vapour721AFactory.sol:Vapour721AFactory",
		constructorArguments: [config.vapour721AStateBuilder],
	});
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
