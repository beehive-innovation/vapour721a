import { artifacts, ethers } from "hardhat";
import { expect } from "chai";
import { Vapour721A } from "../../typechain/Vapour721A";

export const checkChildIntegrity = async (
	vapour721AFactory,
	child,
	constructorConfig
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
		constructorConfig.owner,
		`Owner is ${vapour721a.owner()} not ${constructorConfig.owner}`
	);
	expect(await vapour721a.name()).to.equals(
		constructorConfig.name,
		`name is ${vapour721a.name()} not ${constructorConfig.name}`
	);
	expect(await vapour721a.symbol()).to.equals(
		constructorConfig.symbol,
		`symbol is ${vapour721a.symbol()} not ${constructorConfig.symbol}`
	);
	expect(await vapour721a.baseURI()).to.equals(
		constructorConfig.baseURI,
		`tokenURI is ${vapour721a.tokenURI(2)} not ${constructorConfig.baseURI}`
	);
	expect(await vapour721a._supplyLimit()).to.equals(
		constructorConfig.supplyLimit,
		`totalSupply is ${vapour721a.totalSupply()} not ${constructorConfig.supplyLimit
		}`
	);
	expect(await vapour721a._recipient()).to.equals(
		constructorConfig.recipient,
		`totalSupply is ${vapour721a._recipient()} not ${constructorConfig.recipient}`
	);
};
