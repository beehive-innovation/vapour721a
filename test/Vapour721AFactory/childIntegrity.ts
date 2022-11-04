import {ethers, web3} from "hardhat";
import {expect} from "chai";
import type {
	Vapour721A,
	InitializeConfigStruct,
} from "../../typechain/Vapour721A";
import type {Vapour721AFactory} from "../../typechain/Vapour721AFactory";
import { getPrivate_address, getPrivate_string, getPrivate_uint256, slot } from "../utils";
import { BigNumber } from "ethers";

export const checkChildIntegrity = async (
	vapour721AFactory: Vapour721AFactory,
	child: string,
	initializeConfig: InitializeConfigStruct
) => {
	let vapour721A = (await ethers.getContractAt(
		"Vapour721A",
		child
	)) as Vapour721A;
	
	const supplyLimit = await getPrivate_uint256(child, slot._supplyLimit);
	const amountWithdrawn = await getPrivate_uint256(child, slot._amountWithdrawn);
	const amountPayable = await getPrivate_uint256(child, slot._amountPayable);
	const royaltyBPS = await getPrivate_uint256(child, slot._royaltyBPS);
	const baseURI = await getPrivate_string(child, slot.baseURI);
	const currency = await getPrivate_address(child, slot._currency);
	const recipient = await getPrivate_address(child, slot._recipient);

	expect(await vapour721AFactory.isChild(child)).to.be.true;
	expect(vapour721A.address).to.equals(child);
	expect(await vapour721A.owner()).to.equals(
		initializeConfig.owner,
		`Owner is ${vapour721A.owner()} not ${initializeConfig.owner}`
	);
	expect(await vapour721A.name()).to.equals(
		initializeConfig.name,
		`name is ${vapour721A.name()} not ${initializeConfig.name}`
	);
	expect(await vapour721A.symbol()).to.equals(
		initializeConfig.symbol,
		`symbol is ${vapour721A.symbol()} not ${initializeConfig.symbol}`
	);
	expect(supplyLimit).to.equals(BigNumber.from(initializeConfig.supplyLimit));
	expect(amountWithdrawn).to.equals(ethers.constants.Zero);
	expect(amountPayable).to.equals(ethers.constants.Zero);
	expect(royaltyBPS).to.equals(BigNumber.from(initializeConfig.royaltyBPS));
	expect(baseURI).to.equals(initializeConfig.baseURI);
	expect(currency).to.equals(initializeConfig.currency.toLowerCase());
	expect(recipient).to.equals(initializeConfig.recipient.toLowerCase());
};