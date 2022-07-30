import { artifacts, ethers } from "hardhat";
import { expect } from "chai";
import { Vapour721A } from "../../typechain/Vapour721A";

export const checkChildIntegrity = async (
	vapour721AFactory,
	child,
	initializeConfig
) => {
	let vapour721a = (await ethers.getContractAt(
		(
			await artifacts.readArtifact("Vapour721A")
		).abi,
		child
	)) as Vapour721A;

	expect(await vapour721AFactory.isChild(child)).to.be.true;
	expect(vapour721a.address).to.equals(child);
	expect(await vapour721a.owner()).to.equals(
		initializeConfig.owner,
		`Owner is ${vapour721a.owner()} not ${initializeConfig.owner}`
	);
	expect(await vapour721a.name()).to.equals(
		initializeConfig.name,
		`name is ${vapour721a.name()} not ${initializeConfig.name}`
	);
	expect(await vapour721a.symbol()).to.equals(
		initializeConfig.symbol,
		`symbol is ${vapour721a.symbol()} not ${initializeConfig.symbol}`
	);
};
