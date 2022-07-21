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
	describe("SUPPLY_LIMIT opcode", () => {
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

		it("should eval the correct supplyLimit", async () => {
			const [maxUnits, price] = await rain721a.calculateBuy(buyer1.address, BN(20))
			expect(maxUnits).to.equals(
				rain721aConstructorConfig.supplyLimit
			);
		});

		it("should still eval the correct supplyLimit after a purchase", async () => {
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

	let cap;

	describe("IERC721A_TOTAL_SUPPLY opcode", () => {
		before(async () => {
			// creating a supply cap lower than the supplyLimit in the script
			cap = ethers.BigNumber.from(5)

			const vmStateConfig: StateConfig = {
				sources: [
					concat([
						op(Opcode.CONTEXT, 0),
						op(Opcode.CONSTANT, 1),
						op(Opcode.IERC721A_TOTAL_SUPPLY),
						op(Opcode.SUB, 2),
						op(Opcode.MIN, 2),
						op(Opcode.CONSTANT, 0),
					]),
				],
				constants: [nftPrice, cap],
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

		it("should cap maxUnits when calculating a buy", async () => {
			const targetUnits = cap.add(1)
			const { maxUnits_, price_ } = await rain721a.connect(buyer1).calculateBuy(buyer1.address, targetUnits)

			expect(maxUnits_).to.equals(cap)

		});

		it("should cap maxUnits when minting", async () => {
			await currency
				.connect(buyer1)
				.mintTokens(cap);
			await currency
				.connect(buyer1)
				.approve(
					rain721a.address,
					cap.mul(nftPrice)
				);

			const buyConfig: BuyConfigStruct = {
				minimumUnits: ethers.BigNumber.from(cap),
				desiredUnits: ethers.BigNumber.from(cap).add(1),
				maximumPrice: ethers.BigNumber.from(
					cap.mul(nftPrice)
				),
			};

			await rain721a.connect(buyer1).mintNFT(buyConfig);

			expect(await rain721a.balanceOf(buyer1.address)).to.equals(
				cap
			);
			expect(await rain721a.totalSupply()).to.equals(
				cap
			);

			// second buy should now get 0 maxUnits

			await currency.connect(buyer2).mintTokens(1);
			await currency.connect(buyer2).approve(rain721a.address, 1);

			const buyer2BuyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				desiredUnits: 1,
				maximumPrice: ethers.BigNumber.from(1 + eighteenZeros),
			};

			const { maxUnits_, price_ } = await rain721a.connect(buyer2).calculateBuy(buyer2.address, 1)
			expect(maxUnits_).to.equals(ethers.BigNumber.from(0))

			await expect(rain721a.connect(buyer2).mintNFT(buyer2BuyConfig)).revertedWith(
				"INSUFFICIENT_STOCK"
			);
		});

		it("should allow minting after burning some supply", async () => {
			await rain721a.connect(buyer1).burn(1);

			expect(await rain721a.totalSupply()).to.equals(
				cap.sub(ethers.BigNumber.from(1))
			);

			await currency.connect(buyer2).mintTokens(10);
			await currency.connect(buyer2).approve(rain721a.address, nftPrice);

			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				desiredUnits: 1,
				maximumPrice: nftPrice
			}

			await rain721a.connect(buyer2).mintNFT(buyConfig);

			expect(await rain721a.balanceOf(buyer2.address)).to.equals(1);

			expect(await rain721a.totalSupply()).to.equals(
				cap
			);
		});
	});

	describe("IERC721A_TOTAL_MINTED", () => {
		before(async () => {
			// creating a supply cap lower than the supplyLimit in the script
			cap = ethers.BigNumber.from(5)

			const vmStateConfig: StateConfig = {
				sources: [
					concat([
						op(Opcode.CONTEXT, 0),
						op(Opcode.CONSTANT, 1),
						op(Opcode.IERC721A_TOTAL_MINTED),
						op(Opcode.SUB, 2),
						op(Opcode.MIN, 2),
						op(Opcode.CONSTANT, 0),
					]),
				],
				constants: [nftPrice, cap],
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

		it("should cap maxUnits calculating a buy", async () => {
			const targetUnits = cap.add(1)
			const { maxUnits_, price_ } = await rain721a.connect(buyer1).calculateBuy(buyer1.address, targetUnits)

			expect(maxUnits_).to.equals(cap)

		});

		it("should cap maxUnits when minting", async () => {
			await currency
				.connect(buyer1)
				.mintTokens(cap);
			await currency
				.connect(buyer1)
				.approve(
					rain721a.address,
					cap.mul(nftPrice)
				);

			const buyConfig: BuyConfigStruct = {
				minimumUnits: ethers.BigNumber.from(cap),
				desiredUnits: ethers.BigNumber.from(cap).add(1),
				maximumPrice: ethers.BigNumber.from(
					cap.mul(nftPrice)
				),
			};

			await rain721a.connect(buyer1).mintNFT(buyConfig);

			expect(await rain721a.balanceOf(buyer1.address)).to.equals(
				cap
			);
			expect(await rain721a.totalSupply()).to.equals(
				cap
			);

			// second buy should now get 0 maxUnits

			await currency.connect(buyer2).mintTokens(1);
			await currency.connect(buyer2).approve(rain721a.address, 1);

			const buyer2BuyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				desiredUnits: 1,
				maximumPrice: ethers.BigNumber.from(1 + eighteenZeros),
			};

			const { maxUnits_, price_ } = await rain721a.connect(buyer2).calculateBuy(buyer2.address, 1)
			expect(maxUnits_).to.equals(ethers.BigNumber.from(0))

			await expect(rain721a.connect(buyer2).mintNFT(buyer2BuyConfig)).revertedWith(
				"INSUFFICIENT_STOCK"
			);
		});

		it("should not allow minting after burning some supply", async () => {
			await rain721a.connect(buyer1).burn(1);

			expect(await rain721a.totalSupply()).to.equals(
				cap.sub(ethers.BigNumber.from(1))
			);

			await currency.connect(buyer2).mintTokens(10);
			await currency.connect(buyer2).approve(rain721a.address, nftPrice);

			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				desiredUnits: 1,
				maximumPrice: nftPrice
			}

			await expect(rain721a.connect(buyer2).mintNFT(buyConfig)).revertedWith(
				"INSUFFICIENT_STOCK"
			);

			expect(await rain721a.totalSupply()).to.equals(
				cap.sub(ethers.BigNumber.from(1))
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
