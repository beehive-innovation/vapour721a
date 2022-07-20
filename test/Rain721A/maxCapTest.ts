import { expect } from "chai";
import { ethers } from "hardhat";
import { StateConfig } from "rain-sdk";
import {
	BuyConfigStruct,
	ConstructorConfigStruct,
	Rain721A,
} from "../../typechain/Rain721A";
import {
	buyer0,
	owner,
	rain721AFactory,
	recipient,
	currency,
} from "../1_setup";
import {
	concat,
	eighteenZeros,
	getChild,
	op,
	Opcode,
	StorageOpcodes,
} from "../utils";

let rain721aConstructorConfig: ConstructorConfigStruct;
let rain721a: Rain721A;
const MAX_CAP = 5;

describe("ERC20 token test", () => {
	before(async () => {
		const vmStateConfig: StateConfig = {
			sources: [
				concat([
					op(Opcode.CONSTANT, 0), // 5
					op(Opcode.CONTEXT, 0), // address of minter
					op(Opcode.IERC721A_NUMBER_MINTED),
					op(Opcode.SUB, 2),
					op(Opcode.STORAGE, StorageOpcodes.SUPPLY_LIMIT),
					op(Opcode.IERC721A_TOTAL_SUPPLY),
					op(Opcode.SUB, 2),
					op(Opcode.MIN, 2),
					op(Opcode.CONSTANT, 1),
				]),
			],
			constants: [MAX_CAP, ethers.BigNumber.from("1" + eighteenZeros)],
		};

		rain721aConstructorConfig = {
			name: "nft",
			symbol: "NFT",
			baseURI: "BASE_URI",
			supplyLimit: 100,
			recipient: recipient.address,
			owner: owner.address,
		};

		const deployTrx = await rain721AFactory.createChildTyped(
			rain721aConstructorConfig,
			currency.address,
			vmStateConfig
		);
		const child = await getChild(rain721AFactory, deployTrx);
		rain721a = (await ethers.getContractAt("Rain721A", child)) as Rain721A;
	});

	it("Should Buy 5 nft with erc20 token", async () => {
		await currency.connect(buyer0).mintTokens(5);

		await currency
			.connect(buyer0)
			.approve(rain721a.address, ethers.BigNumber.from(5 + eighteenZeros));

		const buyConfig: BuyConfigStruct = {
			minimumUnits: 1,
			desiredUnits: MAX_CAP,
			maximumPrice: ethers.BigNumber.from(MAX_CAP + eighteenZeros),
		};

		const trx = await rain721a.connect(buyer0).mintNFT(buyConfig);

		expect(await rain721a.balanceOf(buyer0.address)).to.equals(MAX_CAP);
	});

	it("Should fail to Buy nft above max cap", async () => {
		const units = 20;

		await currency.connect(buyer0).mintTokens(1 * units);

		await currency
			.connect(buyer0)
			.approve(rain721a.address, ethers.BigNumber.from(units + eighteenZeros));

		const buyConfig: BuyConfigStruct = {
			minimumUnits: 1,
			desiredUnits: 5,
			maximumPrice: ethers.BigNumber.from(1 + eighteenZeros),
		};
		await expect(rain721a.connect(buyer0).mintNFT(buyConfig)).to.revertedWith(
			"MintZeroQuantity()"
		);

		expect(await rain721a.balanceOf(buyer0.address)).to.equals(MAX_CAP);
	});
});
