import {artifacts, ethers} from "hardhat";
import {expect} from "chai";
import {Vapour721A} from "../../typechain/Vapour721A";

export const checkChildIntegrity = async (
	vapour721AFactory,
	child,
	constructorConfig
) => {
	let rain721a = (await ethers.getContractAt(
		(
			await artifacts.readArtifact("Vapour721A")
		).abi,
		child
	)) as Vapour721A;

	expect(await vapour721AFactory.isChild(child)).to.be.true;
	expect(rain721a.address).to.equals(child);
	expect(await rain721a.owner()).to.equals(
		constructorConfig.owner,
		`Owner is ${rain721a.owner()} not ${constructorConfig.owner}`
	);
	expect(await rain721a.name()).to.equals(
		constructorConfig.name,
		`name is ${rain721a.name()} not ${constructorConfig.name}`
	);
	expect(await rain721a.symbol()).to.equals(
		constructorConfig.symbol,
		`symbol is ${rain721a.symbol()} not ${constructorConfig.symbol}`
	);
	expect(await rain721a.baseURI()).to.equals(
		constructorConfig.baseURI,
		`tokenURI is ${rain721a.tokenURI(2)} not ${constructorConfig.baseURI}`
	);
	expect(await rain721a._supplyLimit()).to.equals(
		constructorConfig.supplyLimit,
		`totalSupply is ${rain721a.totalSupply()} not ${
			constructorConfig.supplyLimit
		}`
	);
	expect(await rain721a._recipient()).to.equals(
		constructorConfig.recipient,
		`totalSupply is ${rain721a._recipient()} not ${constructorConfig.recipient}`
	);
};
