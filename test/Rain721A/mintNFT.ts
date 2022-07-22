import { expect } from "chai";
import { BigNumber } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { StateConfig, VM } from "rain-sdk";
import {
	BuyConfigStruct,
	ConstructorConfigStruct,
	Rain721A,
} from "../../typechain/Rain721A";
import {
	buyer0,
	buyer1,
	buyer2,
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
let nftPrice: BigNumber

describe("mintNFT tests", () => {
	describe("ERC20 token test", () => {
		before(async () => {

			nftPrice = parseEther('1')

			const vmStateConfig: StateConfig = {
				sources: [
					concat([op(VM.Opcodes.CONSTANT, 0), op(VM.Opcodes.CONSTANT, 1)]),
				],
				constants: [20, nftPrice],
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

		it("Should mint 1 NFT for the correct ERC20 amount", async () => {
			const units = ethers.BigNumber.from(1)

			await currency.connect(buyer0).mintTokens(1);

			await currency
				.connect(buyer0)
				.approve(rain721a.address, nftPrice);

			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				desiredUnits: 1,
				maximumPrice: nftPrice,
			};

			const buyerBalanceBefore = await currency.balanceOf(buyer0.address)

			const trx = await rain721a.connect(buyer0).mintNFT(buyConfig);

			const buyerBalanceAfter = await currency.balanceOf(buyer0.address)

			expect(await rain721a.balanceOf(buyer0.address)).to.equals(units);
			expect(buyerBalanceAfter).to.equals(buyerBalanceBefore.sub(nftPrice.mul(units)))
		});

		it("Should mint multiple NFTs for the correct ERC20 amount", async () => {
			const units = ethers.BigNumber.from(20)

			await currency.connect(buyer1).mintTokens(units);

			await currency
				.connect(buyer1)
				.approve(rain721a.address, nftPrice.mul(units));

			const buyConfig: BuyConfigStruct = {
				minimumUnits: units,
				desiredUnits: units,
				maximumPrice: nftPrice,
			};

			const buyerBalanceBefore = await currency.balanceOf(buyer1.address)

			const trx = await rain721a.connect(buyer1).mintNFT(buyConfig);

			const buyerBalanceAfter = await currency.balanceOf(buyer1.address)

			expect(await rain721a.balanceOf(buyer1.address)).to.equals(units);
			expect(buyerBalanceAfter).to.equals(buyerBalanceBefore.sub(nftPrice.mul(units)))
		});
	});

	describe("supply limit tests", async () => {
		before(async () => {
			nftPrice = parseEther('1')

			const vmStateConfig: StateConfig = {
				sources: [
					concat([op(VM.Opcodes.CONSTANT, 0), op(VM.Opcodes.CONSTANT, 1)]),
				],
				constants: [100, nftPrice],
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
		})

		it("should allow minting up to the supply limit", async () => {
			const units = ethers.BigNumber.from(rain721aConstructorConfig.supplyLimit)

			const buyConfig: BuyConfigStruct = {
				minimumUnits: units,
				desiredUnits: units,
				maximumPrice: nftPrice,
			};

			await currency.connect(buyer1).mintTokens(rain721aConstructorConfig.supplyLimit);
			await currency
				.connect(buyer1)
				.approve(rain721a.address, nftPrice.mul(units));

			expect(await rain721a.totalSupply()).to.equals(0)
			await rain721a.connect(buyer1).mintNFT(buyConfig)

			expect(await rain721a.balanceOf(buyer1.address)).to.equals(units)
			expect(await rain721a.totalSupply()).to.equals(rain721aConstructorConfig.supplyLimit)

		});

		it("should fail to buy after supply limit reached", async () => {
			const units = ethers.BigNumber.from(1)

			const buyConfig: BuyConfigStruct = {
				minimumUnits: units,
				desiredUnits: units,
				maximumPrice: nftPrice,
			};

			await currency.connect(buyer1).mintTokens(1);
			await currency
				.connect(buyer1)
				.approve(rain721a.address, nftPrice.mul(units));

			await expect(rain721a.connect(buyer1).mintNFT(buyConfig)).to.revertedWith(
				"INSUFFICIENT_STOCK"
			);
		});

		it("should fail to buy beyond supplyLimit even after NFTs have been burned", async () => {
			await rain721a.connect(buyer1).burn(1)

			expect(await rain721a.balanceOf(buyer1.address)).to.equals(rain721aConstructorConfig.supplyLimit as number - 1)
			expect(await rain721a.totalSupply()).to.equals(rain721aConstructorConfig.supplyLimit as number - 1)

			const units = ethers.BigNumber.from(1)

			const buyConfig: BuyConfigStruct = {
				minimumUnits: units,
				desiredUnits: units,
				maximumPrice: nftPrice,
			};

			await currency.connect(buyer1).mintTokens(1);
			await currency
				.connect(buyer1)
				.approve(rain721a.address, nftPrice.mul(units));

			await expect(rain721a.connect(buyer1).mintNFT(buyConfig)).to.revertedWith(
				"INSUFFICIENT_STOCK"
			);
		});
	});

});

describe("zero price tests", () => {
	before(async () => {
		const vmStateConfig: StateConfig = {
			sources: [
				concat([op(VM.Opcodes.CONSTANT, 0), op(VM.Opcodes.CONSTANT, 1)]),
			],
			constants: [20, 0],
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

	it("Should buy 1 NFT at zero price", async () => {
		const buyConfig: BuyConfigStruct = {
			minimumUnits: 1,
			maximumPrice: 0,
			desiredUnits: 1
		}
		await rain721a.connect(buyer0).mintNFT(buyConfig);
		expect(await rain721a.balanceOf(buyer0.address)).to.equals(1);
	});

	it("Should buy multiple NFTs at zero price", async () => {
		const buyConfig: BuyConfigStruct = {
			minimumUnits: 10,
			maximumPrice: 0,
			desiredUnits: 10
		}
		await rain721a.connect(buyer1).mintNFT(buyConfig);
		expect(await rain721a.balanceOf(buyer1.address)).to.equals(10);
	});
});
