import { expect } from "chai";
import { ethers } from "hardhat";
import { StateConfig } from "rain-sdk";
import {
	BuyConfigStruct,
	ConstructorConfigStruct,
	Rain721A,
} from "../../typechain/Rain721A";
import {
	buyer1,
	buyer2,
	owner,
	rain721AFactory,
	recipient,
	currency,
} from "../1_setup";
import {
	BN,
	concat,
	eighteenZeros,
	getChild,
	op,
	Opcode,
	StorageOpcodes,
} from "../utils";

let rain721aConstructorConfig: ConstructorConfigStruct;
let rain721a: Rain721A;

const nftPrice = ethers.BigNumber.from(1 + eighteenZeros);

describe("Rain721A localOpcodes test", () => {
	describe("totalSupply opcode", () => {
		before(async () => {
			const vmStateConfig: StateConfig = {
				sources: [
					concat([
						op(Opcode.STORAGE, StorageOpcodes.SUPPLY_LIMIT),
						op(Opcode.CONSTANT, 0),
					]),
				],
				constants: [nftPrice],
			};

			rain721aConstructorConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 10,
				recipient: recipient.address,
				owner: owner.address,
			};

			const deployTx = await rain721AFactory.createChildTyped(
				rain721aConstructorConfig,
				currency.address,
				vmStateConfig
			);

			const child = await getChild(rain721AFactory, deployTx);
			rain721a = (await ethers.getContractAt("Rain721A", child)) as Rain721A;
		});

		it("should eval the correct totalSupply", async () => {
			const [maxUnits, price] = await rain721a.calculateBuy(buyer1.address, BN(20))
			expect(maxUnits).to.equals(
				rain721aConstructorConfig.supplyLimit
			);
		});

		it("should still eval the correct totalSupply after a purchase", async () => {
			await currency.connect(buyer1).mintTokens(5)
			await currency.connect(buyer1).approve(rain721a.address, nftPrice.mul(ethers.BigNumber.from(5)))
			await rain721a.connect(buyer1).mintNFT({ maximumPrice: nftPrice, minimumUnits: 1, desiredUnits: 1 })

			const [maxUnits, price] = await rain721a.calculateBuy(buyer1.address, 1)

			expect((await rain721a.balanceOf(buyer1.address))).to.equals(1)

			expect(maxUnits).to.equals(
				rain721aConstructorConfig.supplyLimit
			);
		});
	});

	describe("totalSupply opcode", () => {
		before(async () => {
			const vmStateConfig: StateConfig = {
				sources: [
					concat([
						op(Opcode.CONTEXT, 0),
						op(Opcode.STORAGE, StorageOpcodes.SUPPLY_LIMIT),
						op(Opcode.IERC721A_TOTAL_SUPPLY),
						op(Opcode.SUB, 2),
						op(Opcode.MIN, 2),
						op(Opcode.CONSTANT, 0),
					]),
				],
				constants: [nftPrice],
			};

			rain721aConstructorConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 10,
				recipient: recipient.address,
				owner: owner.address,
			};

			const deployTx = await rain721AFactory.createChildTyped(
				rain721aConstructorConfig,
				currency.address,
				vmStateConfig
			);

			const child = await getChild(rain721AFactory, deployTx);
			rain721a = (await ethers.getContractAt("Rain721A", child)) as Rain721A;
		});

		it("Should be able to buy under SupplyLimit (totalSupply)", async () => {
			await currency
				.connect(buyer1)
				.mintTokens(rain721aConstructorConfig.supplyLimit);
			await currency
				.connect(buyer1)
				.approve(
					rain721a.address,
					ethers.BigNumber.from(
						rain721aConstructorConfig.supplyLimit + eighteenZeros
					)
				);

			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				desiredUnits: rain721aConstructorConfig.supplyLimit,
				maximumPrice: ethers.BigNumber.from(
					rain721aConstructorConfig.supplyLimit + eighteenZeros
				),
			};

			await rain721a.connect(buyer1).mintNFT(buyConfig);

			expect(await rain721a.balanceOf(buyer1.address)).to.equals(
				rain721aConstructorConfig.supplyLimit
			);
			expect(await rain721a.totalSupply()).to.equals(
				rain721aConstructorConfig.supplyLimit
			);
		});

		it("Should fail to able to buy above SupplyLimit (totalSupply)", async () => {
			await currency.connect(buyer2).mintTokens(1);
			await currency.connect(buyer2).approve(rain721a.address, 1);

			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				desiredUnits: 1,
				maximumPrice: ethers.BigNumber.from(1 + eighteenZeros),
			};

			await expect(rain721a.connect(buyer2).mintNFT(buyConfig)).revertedWith(
				"MintZeroQuantity()"
			);
		});

		it("Should burn some nfts", async () => {
			await rain721a.connect(buyer1).burn(1);
			expect(await rain721a.totalSupply()).to.equals(
				Number(rain721aConstructorConfig.supplyLimit) - 1
			);
		});

		// it("Should be able to buy after burning some nfts", async () => {
		// 	await currency.connect(buyer2).mintTokens(10);
		// 	await currency.connect(buyer2).approve(rain721a.address , ethers.BigNumber.from(10 + eighteenZeros));

		// 	const buyConfig:BuyConfigStruct = {
		// 		minimumUnits: 1,
		// 		desiredUnits: 10,
		// 		maximumPrice: ethers.BigNumber.from(10 + eighteenZeros)
		// 	}

		// 	await rain721a.connect(buyer2).mintNFT(buyConfig);

		// 	expect(await rain721a.balanceOf(buyer2.address)).to.equals(1);
		// });
	});

	describe("totalMinted opcode", () => {
		before(async () => {
			const vmStateConfig: StateConfig = {
				sources: [
					concat([
						op(Opcode.CONTEXT, 0),
						op(Opcode.STORAGE, StorageOpcodes.SUPPLY_LIMIT),
						op(Opcode.IERC721A_TOTAL_MINTED),
						op(Opcode.SUB, 2),
						op(Opcode.MIN, 2),
						op(Opcode.CONSTANT, 0),
					]),
				],
				constants: [nftPrice],
			};

			rain721aConstructorConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 10,
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

		it("Should be able to buy under SupplyLimit (totalMinted)", async () => {
			await currency
				.connect(buyer1)
				.mintTokens(rain721aConstructorConfig.supplyLimit);
			await currency
				.connect(buyer1)
				.approve(
					rain721a.address,
					ethers.BigNumber.from(
						rain721aConstructorConfig.supplyLimit + eighteenZeros
					)
				);

			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				desiredUnits: rain721aConstructorConfig.supplyLimit,
				maximumPrice: ethers.BigNumber.from(
					rain721aConstructorConfig.supplyLimit + eighteenZeros
				),
			};

			await rain721a.connect(buyer1).mintNFT(buyConfig);

			expect(await rain721a.balanceOf(buyer1.address)).to.equals(
				rain721aConstructorConfig.supplyLimit
			);
			expect(await rain721a.totalSupply()).to.equals(
				rain721aConstructorConfig.supplyLimit
			);

			expect(await rain721a.totalSupply()).to.equals(10);
		});

		it("Should burn some nft", async () => {
			await rain721a.connect(buyer1).burn(1);
			expect(await rain721a.totalSupply()).to.equals(9);
		});

		it("Should fail to able to buy above SupplyLimit even nfts are burned (totalMinted)", async () => {
			await currency.connect(buyer2).mintTokens(1);
			await currency
				.connect(buyer2)
				.approve(rain721a.address, ethers.BigNumber.from(1));

			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				desiredUnits: 1,
				maximumPrice: ethers.BigNumber.from(1 + eighteenZeros),
			};
			await expect(rain721a.connect(buyer2).mintNFT(buyConfig)).revertedWith(
				"MintZeroQuantity()"
			);
		});
	});

	describe("numberMinted opcode", () => {
		before(async () => {
			const vmStateConfig: StateConfig = {
				sources: [
					concat([
						// quantity
						op(Opcode.STORAGE, StorageOpcodes.SUPPLY_LIMIT),
						op(Opcode.IERC721A_TOTAL_MINTED),
						op(Opcode.SUB, 2),
						// price
						op(Opcode.CONSTANT, 1), // 5
						op(Opcode.CONTEXT, 0),
						op(Opcode.IERC721A_NUMBER_MINTED),
						op(Opcode.GREATER_THAN),
						op(Opcode.CONSTANT, 0), // nftPrice
						op(Opcode.CONSTANT, 0), // nftPrice
						op(Opcode.CONSTANT, 2), // 90
						op(Opcode.MUL, 2),
						op(Opcode.CONSTANT, 3), // 100
						op(Opcode.DIV, 2),
						op(Opcode.EAGER_IF),
					]),
				],
				constants: [nftPrice, 5, 90, 100],
			};
			// Will get 10% discount if minted 5 nfts

			rain721aConstructorConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 10,
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

		it("Should be able to buy 5 nfts with no discount", async () => {
			await currency.connect(buyer1).mintTokens(5);
			await currency.connect(buyer1).approve(rain721a.address, BN(5));

			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				desiredUnits: 5,
				maximumPrice: BN(5),
			};

			await rain721a.connect(buyer1).mintNFT(buyConfig);

			expect(await rain721a.balanceOf(buyer1.address)).to.equals(5);
			expect(await rain721a.totalSupply()).to.equals(5);

			expect(await rain721a._amountPayable()).to.equals(BN(5));
		});

		it("Should be able to buy 5 nfts with 10% discount", async () => {
			await currency.connect(buyer1).mintTokens(5);
			await currency.connect(buyer1).approve(rain721a.address, BN(5));

			const expectedAmountPayable = nftPrice.mul(5).mul(90).div(100);

			await rain721a.connect(recipient).withdraw();

			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				desiredUnits: 5,
				maximumPrice: BN(5),
			};
			await rain721a.connect(buyer1).mintNFT(buyConfig);

			expect(await rain721a.balanceOf(buyer1.address)).to.equals(10);
			expect(await rain721a.totalSupply()).to.equals(10);

			expect(await rain721a._amountPayable()).to.equals(expectedAmountPayable);
		});
	});

	describe("numberBurned opcode", () => {
		before(async () => {
			const vmStateConfig: StateConfig = {
				sources: [
					concat([
						// quantity
						op(Opcode.STORAGE, StorageOpcodes.SUPPLY_LIMIT),
						op(Opcode.IERC721A_TOTAL_MINTED),
						op(Opcode.SUB, 2),
						// price
						op(Opcode.CONSTANT, 1), // 5
						op(Opcode.CONTEXT, 0),
						op(Opcode.IERC721A_NUMBER_BURNED),
						op(Opcode.GREATER_THAN),
						op(Opcode.CONSTANT, 0), // nftPrice
						op(Opcode.CONSTANT, 0), // nftPrice
						op(Opcode.CONSTANT, 2), // 90
						op(Opcode.MUL, 2),
						op(Opcode.CONSTANT, 3), // 100
						op(Opcode.DIV, 2),
						op(Opcode.EAGER_IF),
					]),
				],
				constants: [nftPrice, 5, 90, 100],
			};
			// Will get 10% discount if burned 5 nfts

			rain721aConstructorConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 10,
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

		it("Should be able to buy 5 nfts with no discount", async () => {
			await currency.connect(buyer1).mintTokens(5);
			await currency.connect(buyer1).approve(rain721a.address, BN(5));

			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				desiredUnits: 5,
				maximumPrice: ethers.BigNumber.from(5 + eighteenZeros),
			};

			await rain721a.connect(buyer1).mintNFT(buyConfig);

			expect(await rain721a.balanceOf(buyer1.address)).to.equals(5);
			expect(await rain721a.totalSupply()).to.equals(5);

			expect(await rain721a._amountPayable()).to.equals(nftPrice.mul(5));
		});

		it("Should be able to buy 5 nfts with 10% discount", async () => {
			await currency.connect(buyer1).mintTokens(5);
			await currency.connect(buyer1).approve(rain721a.address, BN(5));

			const expectedAmountPayable = nftPrice.mul(5).mul(90).div(100);

			for (let i = 1; i <= 5; i++) await rain721a.connect(buyer1).burn(i);

			await rain721a.connect(recipient).withdraw();

			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				desiredUnits: 5,
				maximumPrice: BN(5),
			};
			await rain721a.connect(buyer1).mintNFT(buyConfig);

			expect(await rain721a.balanceOf(buyer1.address)).to.equals(5);
			expect(await rain721a.totalSupply()).to.equals(5);

			expect(await rain721a._amountPayable()).to.equals(expectedAmountPayable);
		});
	});
});
