import {expect} from "chai";
import {ethers} from "hardhat";
import {StateConfig} from "rain-sdk";
import {
	BuyConfigStruct,
	InitializeConfigStruct,
	StateConfigStruct,
	Vapour721A,
	WithdrawEvent,
} from "../../typechain/Vapour721A";
import {
	buyer0,
	buyer1,
	buyer2,
	owner,
	vapour721AFactory,
	recipient,
	currency,
} from "../1_setup";
import {
	BN,
	concat,
	eighteenZeros,
	getChild,
	getEventArgs,
	op,
	vapour721AOpcodes as Opcode,
	StorageOpcodes,
	memoryOperand,
	MemoryType,
} from "../utils";

let vapour721AInitializeConfig: InitializeConfigStruct;
let vapour721A: Vapour721A;

const nftPrice = ethers.BigNumber.from(1 + eighteenZeros);

describe("Vapour721A localOpcodes test", () => {
	describe("SUPPLY_LIMIT opcode", () => {
		before(async () => {
			const vmStateConfig: StateConfigStruct = {
				sources: [
					concat([
						op(Opcode.STORAGE, StorageOpcodes.SUPPLY_LIMIT),
						op(Opcode.STATE, memoryOperand(MemoryType.Constant, 0)),
					]),
				],
				constants: [nftPrice],
			};

			vapour721AInitializeConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 10,
				recipient: recipient.address,
				owner: owner.address,
				royaltyBPS: 1000,
				admin: buyer0.address,
				currency: currency.address,
				vmStateConfig: vmStateConfig,
			};

			const deployTx = await vapour721AFactory.createChildTyped(
				vapour721AInitializeConfig
			);

			const child = await getChild(vapour721AFactory, deployTx);
			vapour721A = (await ethers.getContractAt(
				"Vapour721A",
				child
			)) as Vapour721A;
		});

		it("should eval the correct supplyLimit", async () => {
			const [maxUnits, price] = await vapour721A.calculateBuy(
				buyer1.address,
				BN(20)
			);
			expect(maxUnits).to.equals(vapour721AInitializeConfig.supplyLimit);
		});

		it("should still eval the correct supplyLimit after a purchase", async () => {
			await currency.connect(buyer1).mintTokens(5);
			await currency
				.connect(buyer1)
				.approve(vapour721A.address, nftPrice.mul(ethers.BigNumber.from(5)));
			await vapour721A
				.connect(buyer1)
				.mintNFT({maximumPrice: nftPrice, minimumUnits: 1, desiredUnits: 1});

			const [maxUnits, price] = await vapour721A.calculateBuy(
				buyer1.address,
				1
			);

			expect(await vapour721A.balanceOf(buyer1.address)).to.equals(1);

			expect(maxUnits).to.equals(vapour721AInitializeConfig.supplyLimit);
		});
	});

	let cap;

	describe("IERC721A_TOTAL_SUPPLY opcode", () => {
		before(async () => {
			// creating a supply cap lower than the supplyLimit in the script
			cap = ethers.BigNumber.from(5);

			const vmStateConfig: StateConfigStruct = {
				sources: [
					concat([
						op(Opcode.CONTEXT, 1),
						op(Opcode.STATE, memoryOperand(MemoryType.Constant, 1)),
						op(Opcode.IERC721A_TOTAL_SUPPLY),
						op(Opcode.SUB, 2),
						op(Opcode.MIN, 2),
						op(Opcode.STATE, memoryOperand(MemoryType.Constant, 0)),
					]),
				],
				constants: [nftPrice, cap],
			};

			vapour721AInitializeConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 10,
				recipient: recipient.address,
				owner: owner.address,
				royaltyBPS: 1000,
				admin: buyer0.address,
				currency: currency.address,
				vmStateConfig: vmStateConfig,
			};

			const deployTx = await vapour721AFactory.createChildTyped(
				vapour721AInitializeConfig
			);

			const child = await getChild(vapour721AFactory, deployTx);
			vapour721A = (await ethers.getContractAt(
				"Vapour721A",
				child
			)) as Vapour721A;
		});

		it("should cap maxUnits when calculating a buy", async () => {
			const targetUnits = cap.add(1);
			const {maxUnits_, price_} = await vapour721A
				.connect(buyer1)
				.calculateBuy(buyer1.address, targetUnits);

			expect(maxUnits_).to.equals(cap);
		});

		it("should cap maxUnits when minting", async () => {
			await currency.connect(buyer1).mintTokens(cap);
			await currency
				.connect(buyer1)
				.approve(vapour721A.address, cap.mul(nftPrice));

			const buyConfig: BuyConfigStruct = {
				minimumUnits: ethers.BigNumber.from(cap),
				desiredUnits: ethers.BigNumber.from(cap).add(1),
				maximumPrice: ethers.BigNumber.from(cap.mul(nftPrice)),
			};

			await vapour721A.connect(buyer1).mintNFT(buyConfig);

			expect(await vapour721A.balanceOf(buyer1.address)).to.equals(cap);
			expect(await vapour721A.totalSupply()).to.equals(cap);

			// second buy should now get 0 maxUnits

			await currency.connect(buyer2).mintTokens(1);
			await currency.connect(buyer2).approve(vapour721A.address, 1);

			const buyer2BuyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				desiredUnits: 1,
				maximumPrice: ethers.BigNumber.from(1 + eighteenZeros),
			};

			const {maxUnits_, price_} = await vapour721A
				.connect(buyer2)
				.calculateBuy(buyer2.address, 1);
			expect(maxUnits_).to.equals(ethers.BigNumber.from(0));

			await expect(
				vapour721A.connect(buyer2).mintNFT(buyer2BuyConfig)
			).revertedWith("INSUFFICIENT_STOCK");
		});

		it("should allow minting after burning some supply", async () => {
			await vapour721A.connect(buyer1).burn(1);

			expect(await vapour721A.totalSupply()).to.equals(
				cap.sub(ethers.BigNumber.from(1))
			);

			await currency.connect(buyer2).mintTokens(10);
			await currency.connect(buyer2).approve(vapour721A.address, nftPrice);

			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				desiredUnits: 1,
				maximumPrice: nftPrice,
			};

			await vapour721A.connect(buyer2).mintNFT(buyConfig);

			expect(await vapour721A.balanceOf(buyer2.address)).to.equals(1);

			expect(await vapour721A.totalSupply()).to.equals(cap);
		});
	});

	describe("IERC721A_TOTAL_MINTED opcode", () => {
		before(async () => {
			// creating a supply cap lower than the supplyLimit in the script
			cap = ethers.BigNumber.from(5);

			const vmStateConfig: StateConfigStruct = {
				sources: [
					concat([
						op(Opcode.CONTEXT, 1),
						op(Opcode.STATE, memoryOperand(MemoryType.Constant, 1)),
						op(Opcode.IERC721A_TOTAL_MINTED),
						op(Opcode.SUB, 2),
						op(Opcode.MIN, 2),
						op(Opcode.STATE, memoryOperand(MemoryType.Constant, 0)),
					]),
				],
				constants: [nftPrice, cap],
			};

			vapour721AInitializeConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 10,
				recipient: recipient.address,
				owner: owner.address,
				royaltyBPS: 1000,
				admin: buyer0.address,
				currency: currency.address,
				vmStateConfig: vmStateConfig,
			};

			const deployTx = await vapour721AFactory.createChildTyped(
				vapour721AInitializeConfig
			);

			const child = await getChild(vapour721AFactory, deployTx);
			vapour721A = (await ethers.getContractAt(
				"Vapour721A",
				child
			)) as Vapour721A;
		});

		it("should cap maxUnits calculating a buy", async () => {
			const targetUnits = cap.add(1);
			const {maxUnits_, price_} = await vapour721A
				.connect(buyer1)
				.calculateBuy(buyer1.address, targetUnits);

			expect(maxUnits_).to.equals(cap);
		});

		it("should cap maxUnits when minting", async () => {
			await currency.connect(buyer1).mintTokens(cap);
			await currency
				.connect(buyer1)
				.approve(vapour721A.address, cap.mul(nftPrice));

			const buyConfig: BuyConfigStruct = {
				minimumUnits: ethers.BigNumber.from(cap),
				desiredUnits: ethers.BigNumber.from(cap).add(1),
				maximumPrice: ethers.BigNumber.from(cap.mul(nftPrice)),
			};

			await vapour721A.connect(buyer1).mintNFT(buyConfig);

			expect(await vapour721A.balanceOf(buyer1.address)).to.equals(cap);
			expect(await vapour721A.totalSupply()).to.equals(cap);

			// second buy should now get 0 maxUnits

			await currency.connect(buyer2).mintTokens(1);
			await currency.connect(buyer2).approve(vapour721A.address, 1);

			const buyer2BuyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				desiredUnits: 1,
				maximumPrice: ethers.BigNumber.from(1 + eighteenZeros),
			};

			const {maxUnits_, price_} = await vapour721A
				.connect(buyer2)
				.calculateBuy(buyer2.address, 1);
			expect(maxUnits_).to.equals(ethers.BigNumber.from(0));

			await expect(
				vapour721A.connect(buyer2).mintNFT(buyer2BuyConfig)
			).revertedWith("INSUFFICIENT_STOCK");
		});

		it("should not allow minting after burning some supply", async () => {
			await vapour721A.connect(buyer1).burn(1);

			expect(await vapour721A.totalSupply()).to.equals(
				cap.sub(ethers.BigNumber.from(1))
			);

			await currency.connect(buyer2).mintTokens(10);
			await currency.connect(buyer2).approve(vapour721A.address, nftPrice);

			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				desiredUnits: 1,
				maximumPrice: nftPrice,
			};

			await expect(vapour721A.connect(buyer2).mintNFT(buyConfig)).revertedWith(
				"INSUFFICIENT_STOCK"
			);

			expect(await vapour721A.totalSupply()).to.equals(
				cap.sub(ethers.BigNumber.from(1))
			);
		});
	});

	describe("IERC721A_NUMBER_MINTED opcode", () => {
		before(async () => {
			// creating a wallet cap
			cap = ethers.BigNumber.from(5);

			const vmStateConfig: StateConfigStruct = {
				sources: [
					concat([
						op(Opcode.STATE, memoryOperand(MemoryType.Constant, 1)), // cap
						op(Opcode.CONTEXT, 0),
						op(Opcode.IERC721A_NUMBER_MINTED), // how many they've minted
						op(Opcode.SUB, 2), // the remaining units they can mint
						op(Opcode.CONTEXT, 1), // target units
						op(Opcode.MIN, 2), // the smaller of target units and the remaining units they can mint
						op(Opcode.STATE, memoryOperand(MemoryType.Constant, 0)),
					]),
				],
				constants: [nftPrice, cap],
			};

			vapour721AInitializeConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 10,
				recipient: recipient.address,
				owner: owner.address,
				royaltyBPS: 1000,
				admin: buyer0.address,
				currency: currency.address,
				vmStateConfig: vmStateConfig,
			};

			const deployTrx = await vapour721AFactory.createChildTyped(
				vapour721AInitializeConfig
			);
			const child = await getChild(vapour721AFactory, deployTrx);
			vapour721A = (await ethers.getContractAt(
				"Vapour721A",
				child
			)) as Vapour721A;
		});

		it("should allow buyer to mint up to the wallet cap", async () => {
			await currency.connect(buyer1).mintTokens(5);
			await currency.connect(buyer1).approve(vapour721A.address, BN(5));

			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				desiredUnits: 5,
				maximumPrice: BN(5),
			};

			await vapour721A.connect(buyer1).mintNFT(buyConfig);

			expect(await vapour721A.balanceOf(buyer1.address)).to.equals(5);
			expect(await vapour721A.totalSupply()).to.equals(5);
		});

		it("should eval to 0 maxUnits when buyer has already minted up to the wallet cap", async () => {
			const {maxUnits_, price_} = await vapour721A
				.connect(buyer1)
				.calculateBuy(buyer1.address, 1);
			expect(maxUnits_).to.equals(ethers.BigNumber.from(0));
		});

		it("should not allow buyer to mint above the wallet cap", async () => {
			await currency.connect(buyer1).mintTokens(5);
			await currency.connect(buyer1).approve(vapour721A.address, BN(5));

			const expectedAmountPayable = nftPrice.mul(5).mul(90).div(100);

			await vapour721A.connect(recipient).withdraw();

			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				desiredUnits: 5,
				maximumPrice: BN(5),
			};

			await expect(vapour721A.connect(buyer1).mintNFT(buyConfig)).revertedWith(
				"INSUFFICIENT_STOCK"
			);
		});

		it("should eval to 0 maxUnits when buyer has already minted up to the wallet cap, even after burning", async () => {
			await vapour721A.connect(buyer1).burn(1);

			expect(await vapour721A.balanceOf(buyer1.address)).to.equals(4);

			const {maxUnits_, price_} = await vapour721A
				.connect(buyer1)
				.calculateBuy(buyer1.address, 1);
			expect(maxUnits_).to.equals(ethers.BigNumber.from(0));
		});
	});

	describe("IERC721A_NUMBER_MINTED complex script", () => {
		before(async () => {
			const vmStateConfig: StateConfigStruct = {
				sources: [
					concat([
						// quantity
						op(Opcode.STORAGE, StorageOpcodes.SUPPLY_LIMIT),
						op(Opcode.IERC721A_TOTAL_MINTED),
						op(Opcode.SUB, 2),
						// price
						op(Opcode.STATE, memoryOperand(MemoryType.Constant, 1)), // 5
						op(Opcode.CONTEXT, 0),
						op(Opcode.IERC721A_NUMBER_MINTED),
						op(Opcode.GREATER_THAN),
						op(Opcode.STATE, memoryOperand(MemoryType.Constant, 0)), // nftPrice
						op(Opcode.STATE, memoryOperand(MemoryType.Constant, 0)), // nftPrice
						op(Opcode.STATE, memoryOperand(MemoryType.Constant, 2)), // 90
						op(Opcode.MUL, 2),
						op(Opcode.STATE, memoryOperand(MemoryType.Constant, 3)), // 100
						op(Opcode.DIV, 2),
						op(Opcode.EAGER_IF),
					]),
				],
				constants: [nftPrice, 5, 90, 100],
			};
			// Will get 10% discount if minted 5 nfts

			vapour721AInitializeConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 10,
				recipient: recipient.address,
				owner: owner.address,
				royaltyBPS: 1000,
				admin: buyer0.address,
				currency: currency.address,
				vmStateConfig: vmStateConfig,
			};

			const deployTrx = await vapour721AFactory.createChildTyped(
				vapour721AInitializeConfig
			);
			const child = await getChild(vapour721AFactory, deployTrx);
			vapour721A = (await ethers.getContractAt(
				"Vapour721A",
				child
			)) as Vapour721A;
		});

		it("Should be able to buy 5 nfts with no discount", async () => {
			await currency.connect(buyer1).mintTokens(5);
			await currency.connect(buyer1).approve(vapour721A.address, BN(5));

			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				desiredUnits: 5,
				maximumPrice: BN(5),
			};

			await vapour721A.connect(buyer1).mintNFT(buyConfig);

			expect(await vapour721A.balanceOf(buyer1.address)).to.equals(5);
			expect(await vapour721A.totalSupply()).to.equals(5);

			const withdrawTx = await vapour721A.connect(recipient).withdraw();

			const [withdrawer, amountWithdrawn, _totalWithdrawn] =
				(await getEventArgs(
					withdrawTx,
					"Withdraw",
					vapour721A
				)) as WithdrawEvent["args"];

			expect(amountWithdrawn).to.equals(BN(5));
		});

		it("Should be able to buy 5 nfts with 10% discount", async () => {
			await currency.connect(buyer1).mintTokens(5);
			await currency.connect(buyer1).approve(vapour721A.address, BN(5));

			const expectedAmountPayable = nftPrice.mul(5).mul(90).div(100);

			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				desiredUnits: 5,
				maximumPrice: BN(5),
			};
			await vapour721A.connect(buyer1).mintNFT(buyConfig);

			expect(await vapour721A.balanceOf(buyer1.address)).to.equals(10);
			expect(await vapour721A.totalSupply()).to.equals(10);

			const withdrawTx = await vapour721A.connect(recipient).withdraw();

			const [withdrawer, amountWithdrawn, _totalWithdrawn] =
				(await getEventArgs(
					withdrawTx,
					"Withdraw",
					vapour721A
				)) as WithdrawEvent["args"];

			expect(amountWithdrawn).to.equals(expectedAmountPayable);
		});
	});

	describe("IERC721A_NUMBER_BURNED opcode", () => {
		cap = ethers.BigNumber.from(5);
		before(async () => {
			const vmStateConfig: StateConfigStruct = {
				sources: [
					concat([
						// quantity
						op(Opcode.CONTEXT, 1),
						// price
						op(Opcode.CONTEXT, 0),
						op(Opcode.IERC721A_NUMBER_BURNED),
						op(Opcode.STATE, memoryOperand(MemoryType.Constant, 0)),
						op(Opcode.MUL, 2),
					]),
				],
				constants: [nftPrice],
			};

			vapour721AInitializeConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 10,
				recipient: recipient.address,
				owner: owner.address,
				royaltyBPS: 1000,
				admin: buyer0.address,
				currency: currency.address,
				vmStateConfig: vmStateConfig,
			};

			const deployTrx = await vapour721AFactory.createChildTyped(
				vapour721AInitializeConfig
			);
			const child = await getChild(vapour721AFactory, deployTrx);
			vapour721A = (await ethers.getContractAt(
				"Vapour721A",
				child
			)) as Vapour721A;
		});

		it("should eval price to the number of NFTs burned * 10 ** 18", async () => {
			await currency.connect(buyer1).mintTokens(5);
			await currency.connect(buyer1).approve(vapour721A.address, BN(5));

			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				desiredUnits: 1,
				maximumPrice: nftPrice,
			};

			await vapour721A.connect(buyer1).mintNFT(buyConfig);

			let buyCalc = await vapour721A
				.connect(buyer1)
				.calculateBuy(buyer1.address, 1);
			expect(buyCalc.price_).to.equals(ethers.BigNumber.from(0));

			expect(await vapour721A.balanceOf(buyer1.address)).to.equals(1);
			expect(await vapour721A.totalSupply()).to.equals(1);

			await vapour721A.connect(buyer1).burn(1);

			buyCalc = await vapour721A
				.connect(buyer1)
				.calculateBuy(buyer1.address, 1);
			expect(buyCalc.price_).to.equals(ethers.BigNumber.from(1).mul(nftPrice));

			await vapour721A.connect(buyer1).mintNFT(buyConfig);

			expect(await vapour721A.totalSupply()).to.equals(1);
			expect(await vapour721A.balanceOf(buyer1.address)).to.equals(1);
		});
	});

	describe("IERC721A_NUMBER_BURNED opcode complex script", () => {
		before(async () => {
			const vmStateConfig: StateConfigStruct = {
				sources: [
					concat([
						// quantity
						op(Opcode.STORAGE, StorageOpcodes.SUPPLY_LIMIT),
						op(Opcode.IERC721A_TOTAL_MINTED),
						op(Opcode.SUB, 2),
						// price
						op(Opcode.STATE, memoryOperand(MemoryType.Constant, 1)), // 5
						op(Opcode.CONTEXT, 0),
						op(Opcode.IERC721A_NUMBER_BURNED),
						op(Opcode.GREATER_THAN),
						op(Opcode.STATE, memoryOperand(MemoryType.Constant, 0)), // nftPrice
						op(Opcode.STATE, memoryOperand(MemoryType.Constant, 0)), // nftPrice
						op(Opcode.STATE, memoryOperand(MemoryType.Constant, 2)), // 90
						op(Opcode.MUL, 2),
						op(Opcode.STATE, memoryOperand(MemoryType.Constant, 3)), // 100
						op(Opcode.DIV, 2),
						op(Opcode.EAGER_IF),
					]),
				],
				constants: [nftPrice, 5, 90, 100],
			};
			// Will get 10% discount if burned 5 nfts

			vapour721AInitializeConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 10,
				recipient: recipient.address,
				owner: owner.address,
				royaltyBPS: 1000,
				admin: buyer0.address,
				currency: currency.address,
				vmStateConfig: vmStateConfig,
			};

			const deployTrx = await vapour721AFactory.createChildTyped(
				vapour721AInitializeConfig
			);
			const child = await getChild(vapour721AFactory, deployTrx);
			vapour721A = (await ethers.getContractAt(
				"Vapour721A",
				child
			)) as Vapour721A;
		});

		it("Should be able to buy 5 nfts with no discount", async () => {
			await currency.connect(buyer1).mintTokens(5);
			await currency.connect(buyer1).approve(vapour721A.address, BN(5));

			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				desiredUnits: 5,
				maximumPrice: ethers.BigNumber.from(5 + eighteenZeros),
			};

			await vapour721A.connect(buyer1).mintNFT(buyConfig);

			expect(await vapour721A.balanceOf(buyer1.address)).to.equals(5);
			expect(await vapour721A.totalSupply()).to.equals(5);

			const withdrawTx = await vapour721A.connect(recipient).withdraw();

			const [withdrawer, amountWithdrawn, _totalWithdrawn] =
				(await getEventArgs(
					withdrawTx,
					"Withdraw",
					vapour721A
				)) as WithdrawEvent["args"];

			expect(amountWithdrawn).to.equals(nftPrice.mul(5));
		});

		it("Should be able to buy 5 nfts with 10% discount", async () => {
			await currency.connect(buyer1).mintTokens(5);
			await currency.connect(buyer1).approve(vapour721A.address, BN(5));

			const expectedAmountPayable = nftPrice.mul(5).mul(90).div(100);

			for (let i = 1; i <= 5; i++) await vapour721A.connect(buyer1).burn(i);

			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				desiredUnits: 5,
				maximumPrice: BN(5),
			};
			await vapour721A.connect(buyer1).mintNFT(buyConfig);

			expect(await vapour721A.balanceOf(buyer1.address)).to.equals(5);
			expect(await vapour721A.totalSupply()).to.equals(5);

			const withdrawTx = await vapour721A.connect(recipient).withdraw();

			const [withdrawer, amountWithdrawn, _totalWithdrawn] =
				(await getEventArgs(
					withdrawTx,
					"Withdraw",
					vapour721A
				)) as WithdrawEvent["args"];

			expect(amountWithdrawn).to.equals(expectedAmountPayable);
		});
	});

	describe("AMOUNT_PAYABLE opcode", () => {
		cap = ethers.BigNumber.from(5);
		before(async () => {
			// price will be the current amount payable after 2 NFTs have been minted
			const vmStateConfig: StateConfigStruct = {
				sources: [
					concat([
						// quantity
						op(Opcode.CONTEXT, 1),
						// price
						op(Opcode.STORAGE, StorageOpcodes.AMOUNT_PAYABLE),
						op(Opcode.STATE, memoryOperand(MemoryType.Constant, 0)),
						op(Opcode.MAX, 2),
					]),
				],
				constants: [nftPrice],
			};

			vapour721AInitializeConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 10,
				recipient: recipient.address,
				owner: owner.address,
				royaltyBPS: 1000,
				admin: buyer0.address,
				currency: currency.address,
				vmStateConfig: vmStateConfig,
			};

			const deployTrx = await vapour721AFactory.createChildTyped(
				vapour721AInitializeConfig
			);
			const child = await getChild(vapour721AFactory, deployTrx);
			vapour721A = (await ethers.getContractAt(
				"Vapour721A",
				child
			)) as Vapour721A;
		});

		it("should eval price to the current amount payable", async () => {
			await currency.connect(buyer1).mintTokens(5);
			await currency.connect(buyer1).approve(vapour721A.address, BN(5));

			const buyConfig: BuyConfigStruct = {
				minimumUnits: 2,
				desiredUnits: 2,
				maximumPrice: nftPrice,
			};

			let buyCalc = await vapour721A
				.connect(buyer1)
				.calculateBuy(buyer1.address, 1);
			expect(buyCalc.price_).to.equals(nftPrice);

			await vapour721A.connect(buyer1).mintNFT(buyConfig);

			expect(await vapour721A.balanceOf(buyer1.address)).to.equals(2);
			expect(await vapour721A.totalSupply()).to.equals(2);

			buyCalc = await vapour721A
				.connect(buyer1)
				.calculateBuy(buyer1.address, 1);

			const withdrawTx = await vapour721A.connect(recipient).withdraw();

			const [withdrawer, amountWithdrawn, _totalWithdrawn] =
				(await getEventArgs(
					withdrawTx,
					"Withdraw",
					vapour721A
				)) as WithdrawEvent["args"];

			expect(buyCalc.price_).to.equals(amountWithdrawn);
		});

		it("should eval price to the correct amount payable after a withdraw", async () => {
			const buyConfig: BuyConfigStruct = {
				minimumUnits: 2,
				desiredUnits: 2,
				maximumPrice: nftPrice,
			};

			let buyCalc = await vapour721A
				.connect(buyer1)
				.calculateBuy(buyer1.address, 1);
			expect(buyCalc.price_).to.equals(nftPrice);

			await vapour721A.connect(buyer1).mintNFT(buyConfig);

			expect(await vapour721A.balanceOf(buyer1.address)).to.equals(4);
			expect(await vapour721A.totalSupply()).to.equals(4);

			buyCalc = await vapour721A
				.connect(buyer1)
				.calculateBuy(buyer1.address, 1);

			const withdrawTx = await vapour721A.connect(recipient).withdraw();

			const [withdrawer, amountWithdrawn, _totalWithdrawn] =
				(await getEventArgs(
					withdrawTx,
					"Withdraw",
					vapour721A
				)) as WithdrawEvent["args"];

			expect(buyCalc.price_).to.equals(amountWithdrawn);
		});
	});

	describe("AMOUNT_WITHDRAWN opcode", () => {
		cap = ethers.BigNumber.from(5);
		before(async () => {
			// price will be the current amount payable after 2 NFTs have been minted
			const vmStateConfig: StateConfigStruct = {
				sources: [
					concat([
						// quantity
						op(Opcode.CONTEXT, 1),
						// price
						op(Opcode.STORAGE, StorageOpcodes.AMOUNT_WITHDRAWN),
						op(Opcode.STATE, memoryOperand(MemoryType.Constant, 0)),
						op(Opcode.MAX, 2),
					]),
				],
				constants: [nftPrice],
			};

			vapour721AInitializeConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 10,
				recipient: recipient.address,
				owner: owner.address,
				royaltyBPS: 1000,
				admin: buyer0.address,
				currency: currency.address,
				vmStateConfig: vmStateConfig,
			};

			const deployTrx = await vapour721AFactory.createChildTyped(
				vapour721AInitializeConfig
			);
			const child = await getChild(vapour721AFactory, deployTrx);
			vapour721A = (await ethers.getContractAt(
				"Vapour721A",
				child
			)) as Vapour721A;
		});

		it("should eval price to the current amount withdrawn", async () => {
			await currency.connect(buyer1).mintTokens(10);
			await currency.connect(buyer1).approve(vapour721A.address, BN(10));

			const buyConfig: BuyConfigStruct = {
				minimumUnits: 2,
				desiredUnits: 2,
				maximumPrice: nftPrice.mul(ethers.BigNumber.from(4)),
			};

			let buyCalc = await vapour721A
				.connect(buyer1)
				.calculateBuy(buyer1.address, 1);
			expect(buyCalc.price_).to.equals(nftPrice);

			// mint
			await vapour721A.connect(buyer1).mintNFT(buyConfig);

			expect(await vapour721A.balanceOf(buyer1.address)).to.equals(2);
			expect(await vapour721A.totalSupply()).to.equals(2);

			// do a withdraw and check the balance
			let recipientBalance = await currency.balanceOf(recipient.address);
			await vapour721A.connect(recipient).withdraw();
			let totalWithdrawn = nftPrice.mul(
				ethers.BigNumber.from(buyConfig.desiredUnits)
			);
			recipientBalance = recipientBalance.add(totalWithdrawn);
			expect(await currency.balanceOf(recipient.address)).to.equals(
				recipientBalance
			);

			// price should now be the total withdrawn
			buyCalc = await vapour721A
				.connect(buyer1)
				.calculateBuy(buyer1.address, 1);
			expect(buyCalc.price_).to.equals(totalWithdrawn);

			// mint again
			await vapour721A.connect(buyer1).mintNFT(buyConfig);
			expect(await vapour721A.balanceOf(buyer1.address)).to.equals(4);
			expect(await vapour721A.totalSupply()).to.equals(4);

			// do a another withdraw and check the balance
			await vapour721A.connect(recipient).withdraw();
			totalWithdrawn = totalWithdrawn.add(
				buyCalc.price_.mul(ethers.BigNumber.from(buyConfig.desiredUnits))
			);

			recipientBalance = recipientBalance.add(
				buyCalc.price_.mul(ethers.BigNumber.from(buyConfig.desiredUnits))
			);
			expect(await currency.balanceOf(recipient.address)).to.equals(
				recipientBalance
			);

			// price should be the new total withdrawn
			buyCalc = await vapour721A
				.connect(buyer1)
				.calculateBuy(buyer1.address, 1);
			expect(buyCalc.price_).to.equals(totalWithdrawn);
		});
	});
});
