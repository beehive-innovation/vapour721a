import {expect} from "chai";
import {BigNumber} from "ethers";
import {parseEther} from "ethers/lib/utils";
import {ethers} from "hardhat";
import {StateConfig, VM} from "rain-sdk";
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
	buyer3,
} from "../1_setup";
import {
	BN,
	concat,
	getBalance,
	getChild,
	getEventArgs,
	getGasUsed,
	memoryOperand,
	MemoryType,
	op,
	vapour721AOpcodes,
	ZERO_ADDRESS,
} from "../utils";

let vapour721AInitializeConfig: InitializeConfigStruct;
let vapour721A: Vapour721A;
let nftPrice: BigNumber;

const DELEGATED_MINTER = ethers.utils.keccak256(
	ethers.utils.toUtf8Bytes("DELEGATED_MINTER")
);

describe("mintNFT tests", () => {
	describe("total cost tests", () => {
		before(async () => {
			nftPrice = parseEther("1");

			const vmStateConfig: StateConfigStruct = {
				sources: [
					concat([
						op(vapour721AOpcodes.STATE, memoryOperand(MemoryType.Constant, 0)),
						op(vapour721AOpcodes.STATE, memoryOperand(MemoryType.Constant, 1)),
					]),
				],
				constants: [20, nftPrice],
			};

			vapour721AInitializeConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 100,
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
			await vapour721A
				.connect(buyer0)
				.grantRole(DELEGATED_MINTER, buyer0.address);
		});

		it("Should mint 1 NFT for the correct ERC20 amount for another wallet", async () => {
			await vapour721A
				.connect(buyer0)
				.grantRole(DELEGATED_MINTER, buyer0.address);

			const units = ethers.BigNumber.from(1);

			await currency.connect(buyer0).mintTokens(units);

			await currency
				.connect(buyer0)
				.approve(vapour721A.address, nftPrice.mul(units));

			const buyConfig: BuyConfigStruct = {
				minimumUnits: units,
				desiredUnits: units,
				maximumPrice: nftPrice,
			};

			const buyerBalanceBefore = await currency.balanceOf(buyer0.address);

			const {maxUnits_, price_} = await vapour721A.calculateBuy(
				buyer0.address,
				units
			);

			const trx = await vapour721A
				.connect(buyer0)
				.mintNFTFor(
					buyer1.address,
					buyConfig.maximumPrice,
					buyConfig.minimumUnits,
					buyConfig.desiredUnits
				);

			const buyerBalanceAfter = await currency.balanceOf(buyer0.address);

			expect(await vapour721A.balanceOf(buyer1.address)).to.equals(units);
			expect(buyerBalanceAfter).to.equals(
				buyerBalanceBefore.sub(nftPrice.mul(units))
			);
		});

		it("Should mint multiple NFTs for the correct ERC20 amount for another wallet", async () => {
			await vapour721A
				.connect(buyer0)
				.grantRole(DELEGATED_MINTER, buyer1.address);

			const units = ethers.BigNumber.from(20);

			await currency.connect(buyer1).mintTokens(units);

			await currency
				.connect(buyer1)
				.approve(vapour721A.address, nftPrice.mul(units));

			const buyConfig: BuyConfigStruct = {
				minimumUnits: units,
				desiredUnits: units,
				maximumPrice: nftPrice,
			};

			const buyerBalanceBefore = await currency.balanceOf(buyer1.address);

			const trx = await vapour721A
				.connect(buyer1)
				.mintNFTFor(
					buyer0.address,
					buyConfig.maximumPrice,
					buyConfig.minimumUnits,
					buyConfig.desiredUnits
				);

			const buyerBalanceAfter = await currency.balanceOf(buyer1.address);

			expect(await vapour721A.balanceOf(buyer0.address)).to.equals(units);
			expect(buyerBalanceAfter).to.equals(
				buyerBalanceBefore.sub(nftPrice.mul(units))
			);
		});
	});

	describe("supply limit tests", async () => {
		before(async () => {
			nftPrice = parseEther("1");

			const vmStateConfig: StateConfigStruct = {
				sources: [
					concat([
						op(vapour721AOpcodes.STATE, memoryOperand(MemoryType.Constant, 0)),
						op(vapour721AOpcodes.STATE, memoryOperand(MemoryType.Constant, 1)),
					]),
				],
				constants: [100, nftPrice],
			};

			vapour721AInitializeConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 100,
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
			await vapour721A
				.connect(buyer0)
				.grantRole(DELEGATED_MINTER, buyer1.address);
			await vapour721A
				.connect(buyer0)
				.grantRole(DELEGATED_MINTER, buyer0.address);
		});

		it("should allow minting up to the supply limit", async () => {
			const units = ethers.BigNumber.from(
				vapour721AInitializeConfig.supplyLimit
			);

			const buyConfig: BuyConfigStruct = {
				minimumUnits: units,
				desiredUnits: units,
				maximumPrice: nftPrice,
			};

			await currency
				.connect(buyer1)
				.mintTokens(vapour721AInitializeConfig.supplyLimit);
			await currency
				.connect(buyer1)
				.approve(vapour721A.address, nftPrice.mul(units));

			expect(await vapour721A.totalSupply()).to.equals(0);
			await vapour721A
				.connect(buyer1)
				.mintNFTFor(
					buyer0.address,
					buyConfig.maximumPrice,
					buyConfig.minimumUnits,
					buyConfig.desiredUnits
				);

			expect(await vapour721A.balanceOf(buyer0.address)).to.equals(units);
			expect(await vapour721A.totalSupply()).to.equals(
				vapour721AInitializeConfig.supplyLimit
			);
		});

		it("should fail to buy after supply limit reached", async () => {
			const units = ethers.BigNumber.from(1);

			const buyConfig: BuyConfigStruct = {
				minimumUnits: units,
				desiredUnits: units,
				maximumPrice: nftPrice,
			};

			await currency.connect(buyer1).mintTokens(1);
			await currency
				.connect(buyer1)
				.approve(vapour721A.address, nftPrice.mul(units));

			await expect(
				vapour721A
					.connect(buyer1)
					.mintNFTFor(
						buyer0.address,
						buyConfig.maximumPrice,
						buyConfig.minimumUnits,
						buyConfig.desiredUnits
					)
			).to.revertedWith("INSUFFICIENT_STOCK");
		});

		it("should fail to buy beyond supplyLimit even after NFTs have been burned", async () => {
			await vapour721A.connect(buyer0).burn(1);

			expect(await vapour721A.balanceOf(buyer0.address)).to.equals(
				(vapour721AInitializeConfig.supplyLimit as number) - 1
			);
			expect(await vapour721A.totalSupply()).to.equals(
				(vapour721AInitializeConfig.supplyLimit as number) - 1
			);

			const units = ethers.BigNumber.from(1);

			const buyConfig: BuyConfigStruct = {
				minimumUnits: units,
				desiredUnits: units,
				maximumPrice: nftPrice,
			};

			await currency.connect(buyer1).mintTokens(1);
			await currency
				.connect(buyer1)
				.approve(vapour721A.address, nftPrice.mul(units));

			await expect(
				vapour721A
					.connect(buyer1)
					.mintNFTFor(
						buyer0.address,
						buyConfig.maximumPrice,
						buyConfig.minimumUnits,
						buyConfig.desiredUnits
					)
			).to.revertedWith("INSUFFICIENT_STOCK");
		});
	});

	describe("zero price tests", () => {
		before(async () => {
			const vmStateConfig: StateConfigStruct = {
				sources: [
					concat([
						op(vapour721AOpcodes.STATE, memoryOperand(MemoryType.Constant, 0)),
						op(vapour721AOpcodes.STATE, memoryOperand(MemoryType.Constant, 1)),
					]),
				],
				constants: [20, 0],
			};

			vapour721AInitializeConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 100,
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

			await vapour721A
				.connect(buyer0)
				.grantRole(DELEGATED_MINTER, buyer0.address);
			await vapour721A
				.connect(buyer0)
				.grantRole(DELEGATED_MINTER, buyer1.address);
		});

		it("Should buy 1 NFT at zero price", async () => {
			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				maximumPrice: 0,
				desiredUnits: 1,
			};
			await vapour721A
				.connect(buyer0)
				.mintNFTFor(
					buyer1.address,
					buyConfig.maximumPrice,
					buyConfig.minimumUnits,
					buyConfig.desiredUnits
				);
			expect(await vapour721A.balanceOf(buyer1.address)).to.equals(1);
		});

		it("Should buy multiple NFTs at zero price", async () => {
			const buyConfig: BuyConfigStruct = {
				minimumUnits: 10,
				maximumPrice: 0,
				desiredUnits: 10,
			};
			await vapour721A
				.connect(buyer1)
				.mintNFTFor(
					buyer0.address,
					buyConfig.maximumPrice,
					buyConfig.minimumUnits,
					buyConfig.desiredUnits
				);
			expect(await vapour721A.balanceOf(buyer0.address)).to.equals(10);
		});
	});

	describe("revert tests", () => {
		before(async () => {
			nftPrice = parseEther("1");
			const vmStateConfig: StateConfigStruct = {
				sources: [
					concat([
						op(vapour721AOpcodes.CONTEXT, 1), // always allow the target units
						op(vapour721AOpcodes.STATE, memoryOperand(MemoryType.Constant, 0)),
					]),
				],
				constants: [nftPrice],
			};

			vapour721AInitializeConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 100,
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

			await currency
				.connect(buyer1)
				.mintTokens(vapour721AInitializeConfig.supplyLimit);
			await currency
				.connect(buyer1)
				.approve(
					vapour721A.address,
					nftPrice.mul(
						ethers.BigNumber.from(vapour721AInitializeConfig.supplyLimit)
					)
				);

			await vapour721A
				.connect(buyer0)
				.grantRole(DELEGATED_MINTER, buyer0.address);
			await vapour721A
				.connect(buyer0)
				.grantRole(DELEGATED_MINTER, buyer1.address);
			await vapour721A
				.connect(buyer0)
				.grantRole(DELEGATED_MINTER, buyer2.address);
		});

		it("should revert if minimumUnits is 0", async () => {
			const buyConfig: BuyConfigStruct = {
				minimumUnits: 0,
				maximumPrice: 0,
				desiredUnits: 1,
			};
			await expect(
				vapour721A
					.connect(buyer1)
					.mintNFTFor(
						buyer0.address,
						buyConfig.maximumPrice,
						buyConfig.minimumUnits,
						buyConfig.desiredUnits
					)
			).to.revertedWith("0_MINIMUM");
		});

		it("should revert if minimumUnits > desiredUnits", async () => {
			const buyConfig: BuyConfigStruct = {
				minimumUnits: 2,
				maximumPrice: 0,
				desiredUnits: 1,
			};

			await expect(
				vapour721A
					.connect(buyer1)
					.mintNFTFor(
						buyer0.address,
						buyConfig.maximumPrice,
						buyConfig.minimumUnits,
						buyConfig.desiredUnits
					)
			).to.revertedWith("MINIMUM_OVER_DESIRED");
		});

		it("should revert if price is over maximumPrice", async () => {
			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				maximumPrice: nftPrice.div(ethers.BigNumber.from(2)),
				desiredUnits: 1,
			};
			await expect(
				vapour721A
					.connect(buyer1)
					.mintNFTFor(
						buyer0.address,
						buyConfig.maximumPrice,
						buyConfig.minimumUnits,
						buyConfig.desiredUnits
					)
			).to.revertedWith("MAXIMUM_PRICE");
		});

		it("should revert if minimum units exceeds current stock", async () => {
			// buy half the stock
			const buyer1Units =
				(vapour721AInitializeConfig.supplyLimit as number) / 2;
			const buyer1Config: BuyConfigStruct = {
				minimumUnits: buyer1Units,
				maximumPrice: nftPrice,
				desiredUnits: buyer1Units,
			};

			await vapour721A
				.connect(buyer1)
				.mintNFTFor(
					buyer0.address,
					buyer1Config.maximumPrice,
					buyer1Config.minimumUnits,
					buyer1Config.desiredUnits
				);
			expect(await vapour721A.totalSupply()).to.equals(buyer1Units);
			expect(await vapour721A.balanceOf(buyer0.address)).to.equals(buyer1Units);

			// attempt to buy more than the stock remaining
			const buyer2Units =
				(vapour721AInitializeConfig.supplyLimit as number) - buyer1Units + 1;
			const buyer2Config: BuyConfigStruct = {
				minimumUnits: buyer2Units,
				maximumPrice: nftPrice,
				desiredUnits: buyer2Units,
			};

			await expect(
				vapour721A
					.connect(buyer2)
					.mintNFTFor(
						buyer1.address,
						buyer2Config.maximumPrice,
						buyer2Config.minimumUnits,
						buyer2Config.desiredUnits
					)
			).to.revertedWith("INSUFFICIENT_STOCK");
		});
	});
});

describe("mintNFT tests (Native Tokens)", () => {
	describe("total cost tests", () => {
		before(async () => {
			nftPrice = parseEther("1");

			const vmStateConfig: StateConfigStruct = {
				sources: [
					concat([
						op(vapour721AOpcodes.STATE, memoryOperand(MemoryType.Constant, 0)),
						op(vapour721AOpcodes.STATE, memoryOperand(MemoryType.Constant, 1)),
					]),
				],
				constants: [20, nftPrice],
			};

			vapour721AInitializeConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 100,
				recipient: recipient.address,
				owner: owner.address,
				royaltyBPS: 1000,
				admin: buyer0.address,
				currency: ZERO_ADDRESS,
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

			await vapour721A
				.connect(buyer0)
				.grantRole(DELEGATED_MINTER, buyer0.address);
			await vapour721A
				.connect(buyer0)
				.grantRole(DELEGATED_MINTER, buyer1.address);
		});

		it("Should mint 1 NFT for the correct native token amount", async () => {
			const units = ethers.BigNumber.from(1);

			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				desiredUnits: 1,
				maximumPrice: nftPrice,
			};

			const buyerBalanceBefore = await getBalance(ZERO_ADDRESS, buyer0);

			const trx = await vapour721A
				.connect(buyer0)
				.mintNFTFor(
					buyer1.address,
					buyConfig.maximumPrice,
					buyConfig.minimumUnits,
					buyConfig.desiredUnits,
					{value: buyConfig.maximumPrice}
				);

			const gasUsed = await getGasUsed(trx);

			const buyerBalanceAfter = await getBalance(ZERO_ADDRESS, buyer0);
			expect(await vapour721A.balanceOf(buyer1.address)).to.equals(units);
			expect(buyerBalanceAfter.add(gasUsed)).to.equals(
				buyerBalanceBefore.sub(nftPrice.mul(units))
			);
		});

		it("Should mint multiple NFTs for the correct native token amount", async () => {
			const units = ethers.BigNumber.from(20);

			const buyConfig: BuyConfigStruct = {
				minimumUnits: units,
				desiredUnits: units,
				maximumPrice: BN(1).mul(units),
			};

			const buyerBalanceBefore = await getBalance(ZERO_ADDRESS, buyer1);

			const trx = await vapour721A
				.connect(buyer1)
				.mintNFTFor(
					buyer0.address,
					buyConfig.maximumPrice,
					buyConfig.minimumUnits,
					buyConfig.desiredUnits,
					{value: buyConfig.maximumPrice}
				);
			const gasUsed = await getGasUsed(trx);
			const buyerBalanceAfter = await getBalance(ZERO_ADDRESS, buyer1);

			expect(await vapour721A.balanceOf(buyer0.address)).to.equals(units);
			expect(buyerBalanceAfter.add(gasUsed)).to.equals(
				buyerBalanceBefore.sub(nftPrice.mul(units))
			);
		});
	});

	describe("supply limit tests", async () => {
		before(async () => {
			nftPrice = parseEther("1");

			const vmStateConfig: StateConfigStruct = {
				sources: [
					concat([
						op(vapour721AOpcodes.STATE, memoryOperand(MemoryType.Constant, 0)),
						op(vapour721AOpcodes.STATE, memoryOperand(MemoryType.Constant, 1)),
					]),
				],
				constants: [100, nftPrice],
			};

			vapour721AInitializeConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 100,
				recipient: recipient.address,
				owner: owner.address,
				royaltyBPS: 1000,
				admin: buyer0.address,
				currency: ZERO_ADDRESS,
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

			await vapour721A
				.connect(buyer0)
				.grantRole(DELEGATED_MINTER, buyer0.address);
			await vapour721A
				.connect(buyer0)
				.grantRole(DELEGATED_MINTER, buyer1.address);
		});

		it("should allow minting up to the supply limit", async () => {
			const units = ethers.BigNumber.from(
				vapour721AInitializeConfig.supplyLimit
			);

			const buyConfig: BuyConfigStruct = {
				minimumUnits: units,
				desiredUnits: units,
				maximumPrice: nftPrice.mul(units),
			};

			expect(await vapour721A.totalSupply()).to.equals(0);
			await vapour721A
				.connect(buyer1)
				.mintNFTFor(
					buyer0.address,
					buyConfig.maximumPrice,
					buyConfig.minimumUnits,
					buyConfig.desiredUnits,
					{value: buyConfig.maximumPrice}
				);

			expect(await vapour721A.balanceOf(buyer0.address)).to.equals(units);
			expect(await vapour721A.totalSupply()).to.equals(
				vapour721AInitializeConfig.supplyLimit
			);
		});

		it("should fail to buy after supply limit reached", async () => {
			const units = ethers.BigNumber.from(1);

			const buyConfig: BuyConfigStruct = {
				minimumUnits: units,
				desiredUnits: units,
				maximumPrice: nftPrice,
			};

			await expect(
				vapour721A
					.connect(buyer1)
					.mintNFTFor(
						buyer0.address,
						buyConfig.maximumPrice,
						buyConfig.minimumUnits,
						buyConfig.desiredUnits,
						{value: buyConfig.maximumPrice}
					)
			).to.revertedWith("INSUFFICIENT_STOCK");
		});

		it("should fail to buy beyond supplyLimit even after NFTs have been burned", async () => {
			await vapour721A.connect(buyer0).burn(1);

			expect(await vapour721A.balanceOf(buyer0.address)).to.equals(
				(vapour721AInitializeConfig.supplyLimit as number) - 1
			);
			expect(await vapour721A.totalSupply()).to.equals(
				(vapour721AInitializeConfig.supplyLimit as number) - 1
			);

			const units = ethers.BigNumber.from(1);

			const buyConfig: BuyConfigStruct = {
				minimumUnits: units,
				desiredUnits: units,
				maximumPrice: nftPrice,
			};

			await expect(
				vapour721A
					.connect(buyer1)
					.mintNFTFor(
						buyer0.address,
						buyConfig.maximumPrice,
						buyConfig.minimumUnits,
						buyConfig.desiredUnits,
						{value: buyConfig.maximumPrice}
					)
			).to.revertedWith("INSUFFICIENT_STOCK");
		});
	});

	describe("zero price tests", () => {
		before(async () => {
			const vmStateConfig: StateConfigStruct = {
				sources: [
					concat([
						op(vapour721AOpcodes.STATE, memoryOperand(MemoryType.Constant, 0)),
						op(vapour721AOpcodes.STATE, memoryOperand(MemoryType.Constant, 1)),
					]),
				],
				constants: [20, 0],
			};

			vapour721AInitializeConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 100,
				recipient: recipient.address,
				owner: owner.address,
				royaltyBPS: 1000,
				admin: buyer0.address,
				currency: ZERO_ADDRESS,
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

			await vapour721A
				.connect(buyer0)
				.grantRole(DELEGATED_MINTER, buyer0.address);
			await vapour721A
				.connect(buyer0)
				.grantRole(DELEGATED_MINTER, buyer1.address);
		});

		it("Should buy 1 NFT at zero price", async () => {
			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				maximumPrice: 0,
				desiredUnits: 1,
			};
			await vapour721A
				.connect(buyer0)
				.mintNFTFor(
					buyer1.address,
					buyConfig.maximumPrice,
					buyConfig.minimumUnits,
					buyConfig.desiredUnits,
					{value: buyConfig.maximumPrice}
				);
			expect(await vapour721A.balanceOf(buyer1.address)).to.equals(1);
		});

		it("Should buy multiple NFTs at zero price", async () => {
			const buyConfig: BuyConfigStruct = {
				minimumUnits: 10,
				maximumPrice: 0,
				desiredUnits: 10,
			};
			await vapour721A
				.connect(buyer1)
				.mintNFTFor(
					buyer0.address,
					buyConfig.maximumPrice,
					buyConfig.minimumUnits,
					buyConfig.desiredUnits,
					{value: buyConfig.maximumPrice}
				);
			expect(await vapour721A.balanceOf(buyer0.address)).to.equals(10);
		});
	});

	describe("revert tests", () => {
		before(async () => {
			nftPrice = parseEther("1");
			const vmStateConfig: StateConfigStruct = {
				sources: [
					concat([
						op(vapour721AOpcodes.CONTEXT, 1), // always allow the target units
						op(vapour721AOpcodes.STATE, memoryOperand(MemoryType.Constant, 0)),
					]),
				],
				constants: [nftPrice],
			};

			vapour721AInitializeConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 100,
				recipient: recipient.address,
				owner: owner.address,
				royaltyBPS: 1000,
				admin: buyer0.address,
				currency: ZERO_ADDRESS,
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

			await currency
				.connect(buyer1)
				.mintTokens(vapour721AInitializeConfig.supplyLimit);
			await currency
				.connect(buyer1)
				.approve(
					vapour721A.address,
					nftPrice.mul(
						ethers.BigNumber.from(vapour721AInitializeConfig.supplyLimit)
					)
				);

			await vapour721A
				.connect(buyer0)
				.grantRole(DELEGATED_MINTER, buyer0.address);
			await vapour721A
				.connect(buyer0)
				.grantRole(DELEGATED_MINTER, buyer1.address);
			await vapour721A
				.connect(buyer0)
				.grantRole(DELEGATED_MINTER, buyer2.address);
			await vapour721A
				.connect(buyer0)
				.grantRole(DELEGATED_MINTER, buyer3.address);
		});

		it("should revert if minimumUnits is 0", async () => {
			const buyConfig: BuyConfigStruct = {
				minimumUnits: 0,
				maximumPrice: 0,
				desiredUnits: 1,
			};
			await expect(
				vapour721A
					.connect(buyer1)
					.mintNFTFor(
						buyer0.address,
						buyConfig.maximumPrice,
						buyConfig.minimumUnits,
						buyConfig.desiredUnits,
						{value: buyConfig.maximumPrice}
					)
			).to.revertedWith("0_MINIMUM");
		});

		it("should revert if minimumUnits > desiredUnits", async () => {
			const buyConfig: BuyConfigStruct = {
				minimumUnits: 2,
				maximumPrice: 0,
				desiredUnits: 1,
			};

			await expect(
				vapour721A
					.connect(buyer1)
					.mintNFTFor(
						buyer0.address,
						buyConfig.maximumPrice,
						buyConfig.minimumUnits,
						buyConfig.desiredUnits,
						{value: buyConfig.maximumPrice}
					)
			).to.revertedWith("MINIMUM_OVER_DESIRED");
		});

		it("should revert if price is over maximumPrice", async () => {
			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				maximumPrice: nftPrice.div(ethers.BigNumber.from(2)),
				desiredUnits: 1,
			};
			await expect(
				vapour721A
					.connect(buyer1)
					.mintNFTFor(
						buyer0.address,
						buyConfig.maximumPrice,
						buyConfig.minimumUnits,
						buyConfig.desiredUnits,
						{value: buyConfig.maximumPrice}
					)
			).to.revertedWith("MAXIMUM_PRICE");
		});

		it("should revert if minimum units exceeds current stock", async () => {
			// buy half the stock
			const buyer1Units =
				(vapour721AInitializeConfig.supplyLimit as number) / 2;
			const buyer1Config: BuyConfigStruct = {
				minimumUnits: buyer1Units,
				maximumPrice: nftPrice.mul(buyer1Units),
				desiredUnits: buyer1Units,
			};

			await vapour721A
				.connect(buyer1)
				.mintNFTFor(
					buyer0.address,
					buyer1Config.maximumPrice,
					buyer1Config.minimumUnits,
					buyer1Config.desiredUnits,
					{value: buyer1Config.maximumPrice}
				);
			expect(await vapour721A.totalSupply()).to.equals(buyer1Units);
			expect(await vapour721A.balanceOf(buyer0.address)).to.equals(buyer1Units);

			// attempt to buy more than the stock remaining
			const buyer2Units =
				(vapour721AInitializeConfig.supplyLimit as number) - buyer1Units + 1;
			const buyer2Config: BuyConfigStruct = {
				minimumUnits: buyer2Units,
				maximumPrice: nftPrice,
				desiredUnits: buyer2Units,
			};

			await expect(
				vapour721A
					.connect(buyer2)
					.mintNFTFor(
						buyer0.address,
						buyer2Config.maximumPrice,
						buyer2Config.minimumUnits,
						buyer2Config.desiredUnits,
						{value: buyer2Config.maximumPrice}
					)
			).to.revertedWith("INSUFFICIENT_STOCK");
		});

		it("Should fail to mint if not enough native tokens are sent", async () => {
			const buyConfig: BuyConfigStruct = {
				minimumUnits: 2,
				desiredUnits: 2,
				maximumPrice: BN(2),
			};

			await expect(
				vapour721A
					.connect(buyer3)
					.mintNFTFor(
						buyer0.address,
						buyConfig.maximumPrice,
						buyConfig.minimumUnits,
						buyConfig.desiredUnits,
						{value: BN(1)}
					)
			).to.revertedWith("INSUFFICIENT_FUND");
		});
	});

	describe("Native token extra value test", () => {
		before(async () => {
			const _supplyLimit = ethers.BigNumber.from(100);
			const vmStateConfig: StateConfigStruct = {
				sources: [
					concat([
						op(vapour721AOpcodes.STATE, memoryOperand(MemoryType.Constant, 0)),
						op(vapour721AOpcodes.STATE, memoryOperand(MemoryType.Constant, 1)),
					]),
				],
				constants: [200, BN(1)],
			};

			vapour721AInitializeConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "baseURI",
				supplyLimit: _supplyLimit,
				recipient: recipient.address,
				owner: owner.address,
				royaltyBPS: 1000,
				admin: buyer0.address,
				currency: ZERO_ADDRESS,
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

			await vapour721A
				.connect(buyer0)
				.grantRole(DELEGATED_MINTER, buyer0.address);
			await vapour721A
				.connect(buyer0)
				.grantRole(DELEGATED_MINTER, buyer2.address);
		});

		it("Should returns remaining native tokens after buying", async () => {
			const buyConfig: BuyConfigStruct = {
				minimumUnits: 2,
				desiredUnits: 2,
				maximumPrice: BN(3),
			};

			const buyerBeforeBalance = await getBalance(ZERO_ADDRESS, buyer2);

			const buyTrx = await vapour721A
				.connect(buyer2)
				.mintNFTFor(
					buyer0.address,
					buyConfig.maximumPrice,
					buyConfig.minimumUnits,
					buyConfig.desiredUnits,
					{value: buyConfig.maximumPrice}
				);
			const gasUsed = await getGasUsed(buyTrx);

			const buyerAfterBalance = await getBalance(ZERO_ADDRESS, buyer2);

			expect(buyerBeforeBalance.sub(gasUsed)).to.equals(
				buyerAfterBalance.add(BN(2))
			);

			const withdrawTx = await vapour721A.connect(recipient).withdraw();

			const [withdrawer, amountWithdrawn, _totalWithdrawn] =
				(await getEventArgs(
					withdrawTx,
					"Withdraw",
					vapour721A
				)) as WithdrawEvent["args"];

			expect(amountWithdrawn).to.equals(BN(2));
		});
	});
});
