import {ethers} from "hardhat";
import {expect} from "chai";
import type {
	Vapour721A,
	InitializeConfigStruct,
} from "../../typechain/Vapour721A";
import type {Vapour721AFactory} from "../../typechain/Vapour721AFactory";

export const checkChildIntegrity = async (
	vapour721AFactory: Vapour721AFactory,
	child: string,
	initializeConfig: InitializeConfigStruct
) => {
	let vapour721a = (await ethers.getContractAt(
		"Vapour721A",
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
