import { expect } from "chai";
import { BigNumber } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { StateConfig, VM } from "rain-sdk";
import {
	BuyConfigStruct,
	ConstructorConfigStruct,
	Vapour721A,
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
	getBalance,
	getChild,
	getGasUsed,
	op,
	ZERO_ADDRESS,
} from "../utils";

let vapour721AConstructorConfig: ConstructorConfigStruct;
let vapour721A: Vapour721A;
let nftPrice: BigNumber

describe("mintNFT tests", () => {
	describe("total cost tests", () => {
		before(async () => {

			nftPrice = parseEther('1')

			const vmStateConfig: StateConfig = {
				sources: [
					concat([op(VM.Opcodes.CONSTANT, 0), op(VM.Opcodes.CONSTANT, 1)]),
				],
				constants: [20, nftPrice],
			};

			vapour721AConstructorConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 100,
				recipient: recipient.address,
				owner: owner.address,
				royaltyBPS: 1000
			};

			const deployTrx = await vapour721AFactory.createChildTyped(
				vapour721AConstructorConfig,
				currency.address,
				vmStateConfig
			);
			const child = await getChild(vapour721AFactory, deployTrx);
			vapour721A = (await ethers.getContractAt("Vapour721A", child)) as Vapour721A;
		});

		it("Should mint 1 NFT for the correct ERC20 amount", async () => {
			const units = ethers.BigNumber.from(1)

			await currency.connect(buyer0).mintTokens(1);

			await currency
				.connect(buyer0)
				.approve(vapour721A.address, nftPrice);

			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				desiredUnits: 1,
				maximumPrice: nftPrice,
			};

			const buyerBalanceBefore = await currency.balanceOf(buyer0.address)

			const trx = await vapour721A.connect(buyer0).mintNFT(buyConfig);

			const buyerBalanceAfter = await currency.balanceOf(buyer0.address)

			expect(await vapour721A.balanceOf(buyer0.address)).to.equals(units);
			expect(buyerBalanceAfter).to.equals(buyerBalanceBefore.sub(nftPrice.mul(units)))
		});

		it("Should mint multiple NFTs for the correct ERC20 amount", async () => {
			const units = ethers.BigNumber.from(20)

			await currency.connect(buyer1).mintTokens(units);

			await currency
				.connect(buyer1)
				.approve(vapour721A.address, nftPrice.mul(units));

			const buyConfig: BuyConfigStruct = {
				minimumUnits: units,
				desiredUnits: units,
				maximumPrice: nftPrice,
			};

			const buyerBalanceBefore = await currency.balanceOf(buyer1.address)

			const trx = await vapour721A.connect(buyer1).mintNFT(buyConfig);

			const buyerBalanceAfter = await currency.balanceOf(buyer1.address)

			expect(await vapour721A.balanceOf(buyer1.address)).to.equals(units);
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

			vapour721AConstructorConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 100,
				recipient: recipient.address,
				owner: owner.address,
				royaltyBPS: 1000
			};

			const deployTrx = await vapour721AFactory.createChildTyped(
				vapour721AConstructorConfig,
				currency.address,
				vmStateConfig
			);

			const child = await getChild(vapour721AFactory, deployTrx);
			vapour721A = (await ethers.getContractAt("Vapour721A", child)) as Vapour721A;
		})

		it("should allow minting up to the supply limit", async () => {
			const units = ethers.BigNumber.from(vapour721AConstructorConfig.supplyLimit)

			const buyConfig: BuyConfigStruct = {
				minimumUnits: units,
				desiredUnits: units,
				maximumPrice: nftPrice,
			};

			await currency.connect(buyer1).mintTokens(vapour721AConstructorConfig.supplyLimit);
			await currency
				.connect(buyer1)
				.approve(vapour721A.address, nftPrice.mul(units));

			expect(await vapour721A.totalSupply()).to.equals(0)
			await vapour721A.connect(buyer1).mintNFT(buyConfig)

			expect(await vapour721A.balanceOf(buyer1.address)).to.equals(units)
			expect(await vapour721A.totalSupply()).to.equals(vapour721AConstructorConfig.supplyLimit)

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
				.approve(vapour721A.address, nftPrice.mul(units));

			await expect(vapour721A.connect(buyer1).mintNFT(buyConfig)).to.revertedWith(
				"INSUFFICIENT_STOCK"
			);
		});

		it("should fail to buy beyond supplyLimit even after NFTs have been burned", async () => {
			await vapour721A.connect(buyer1).burn(1)

			expect(await vapour721A.balanceOf(buyer1.address)).to.equals(vapour721AConstructorConfig.supplyLimit as number - 1)
			expect(await vapour721A.totalSupply()).to.equals(vapour721AConstructorConfig.supplyLimit as number - 1)

			const units = ethers.BigNumber.from(1)

			const buyConfig: BuyConfigStruct = {
				minimumUnits: units,
				desiredUnits: units,
				maximumPrice: nftPrice,
			};

			await currency.connect(buyer1).mintTokens(1);
			await currency
				.connect(buyer1)
				.approve(vapour721A.address, nftPrice.mul(units));

			await expect(vapour721A.connect(buyer1).mintNFT(buyConfig)).to.revertedWith(
				"INSUFFICIENT_STOCK"
			);
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

			vapour721AConstructorConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 100,
				recipient: recipient.address,
				owner: owner.address,
				royaltyBPS: 1000
			};

			const deployTrx = await vapour721AFactory.createChildTyped(
				vapour721AConstructorConfig,
				currency.address,
				vmStateConfig
			);
			const child = await getChild(vapour721AFactory, deployTrx);
			vapour721A = (await ethers.getContractAt("Vapour721A", child)) as Vapour721A;
		});

		it("Should buy 1 NFT at zero price", async () => {
			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				maximumPrice: 0,
				desiredUnits: 1
			}
			await vapour721A.connect(buyer0).mintNFT(buyConfig);
			expect(await vapour721A.balanceOf(buyer0.address)).to.equals(1);
		});

		it("Should buy multiple NFTs at zero price", async () => {
			const buyConfig: BuyConfigStruct = {
				minimumUnits: 10,
				maximumPrice: 0,
				desiredUnits: 10
			}
			await vapour721A.connect(buyer1).mintNFT(buyConfig);
			expect(await vapour721A.balanceOf(buyer1.address)).to.equals(10);
		});
	});

	describe("revert tests", () => {
		before(async () => {
			nftPrice = parseEther('1')
			const vmStateConfig: StateConfig = {
				sources: [
					concat([
						op(VM.Opcodes.CONTEXT, 1), // always allow the target units
						op(VM.Opcodes.CONSTANT, 0)
					]),
				],
				constants: [nftPrice],
			};

			vapour721AConstructorConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 100,
				recipient: recipient.address,
				owner: owner.address,
				royaltyBPS: 1000
			};

			const deployTrx = await vapour721AFactory.createChildTyped(
				vapour721AConstructorConfig,
				currency.address,
				vmStateConfig
			);
			const child = await getChild(vapour721AFactory, deployTrx);
			vapour721A = (await ethers.getContractAt("Vapour721A", child)) as Vapour721A;

			await currency.connect(buyer1).mintTokens(vapour721AConstructorConfig.supplyLimit)
			await currency.connect(buyer1).approve(vapour721A.address, nftPrice.mul(ethers.BigNumber.from(vapour721AConstructorConfig.supplyLimit)))
		});

		it("should revert if minimumUnits is 0", async () => {
			const buyConfig: BuyConfigStruct = {
				minimumUnits: 0,
				maximumPrice: 0,
				desiredUnits: 1
			}
			await expect(vapour721A.connect(buyer1).mintNFT(buyConfig)).to.revertedWith(
				"0_MINIMUM"
			);
		});

		it("should revert if minimumUnits > desiredUnits", async () => {
			const buyConfig: BuyConfigStruct = {
				minimumUnits: 2,
				maximumPrice: 0,
				desiredUnits: 1
			}

			await expect(vapour721A.connect(buyer1).mintNFT(buyConfig)).to.revertedWith(
				"MINIMUM_OVER_DESIRED"
			);
		});

		it("should revert if price is over maximumPrice", async () => {
			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				maximumPrice: nftPrice.div(ethers.BigNumber.from(2)),
				desiredUnits: 1
			}
			await expect(vapour721A.connect(buyer1).mintNFT(buyConfig)).to.revertedWith(
				"MAXIMUM_PRICE"
			);
		});

		it("should revert if minimum units exceeds current stock", async () => {
			// buy half the stock
			const buyer1Units = vapour721AConstructorConfig.supplyLimit as number / 2
			const buyer1Config: BuyConfigStruct = {
				minimumUnits: buyer1Units,
				maximumPrice: nftPrice,
				desiredUnits: buyer1Units
			}

			await vapour721A.connect(buyer1).mintNFT(buyer1Config)
			expect(await vapour721A.totalSupply()).to.equals(buyer1Units)
			expect(await vapour721A.balanceOf(buyer1.address)).to.equals(buyer1Units)

			// attempt to buy more than the stock remaining
			const buyer2Units = vapour721AConstructorConfig.supplyLimit as number - buyer1Units + 1
			const buyer2Config: BuyConfigStruct = {
				minimumUnits: buyer2Units,
				maximumPrice: nftPrice,
				desiredUnits: buyer2Units
			}

			await expect(vapour721A.connect(buyer2).mintNFT(buyer2Config)).to.revertedWith(
				"INSUFFICIENT_STOCK"
			);
		});
	});
});

describe("mintNFT tests (Native Tokens)", () => {
	describe("total cost tests", () => {
		before(async () => {

			nftPrice = parseEther('1')

			const vmStateConfig: StateConfig = {
				sources: [
					concat([op(VM.Opcodes.CONSTANT, 0), op(VM.Opcodes.CONSTANT, 1)]),
				],
				constants: [20, nftPrice],
			};

			vapour721AConstructorConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 100,
				recipient: recipient.address,
				owner: owner.address,
				royaltyBPS: 1000
			};

			const deployTrx = await vapour721AFactory.createChildTyped(
				vapour721AConstructorConfig,
				ZERO_ADDRESS,
				vmStateConfig
			);
			const child = await getChild(vapour721AFactory, deployTrx);
			vapour721A = (await ethers.getContractAt("Vapour721A", child)) as Vapour721A;
		});

		it("Should mint 1 NFT for the correct native token amount", async () => {
			const units = ethers.BigNumber.from(1)

			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				desiredUnits: 1,
				maximumPrice: nftPrice,
			};

			const buyerBalanceBefore = await getBalance(ZERO_ADDRESS, buyer0);

			const trx = await vapour721A.connect(buyer0).mintNFT(buyConfig, {value: buyConfig.maximumPrice});

			const gasUsed = await getGasUsed(trx);

			const buyerBalanceAfter = await getBalance(ZERO_ADDRESS, buyer0);
			expect(await vapour721A.balanceOf(buyer0.address)).to.equals(units);
			expect(buyerBalanceAfter.add(gasUsed)).to.equals(buyerBalanceBefore.sub(nftPrice.mul(units)))
		});

		it("Should mint multiple NFTs for the correct native token amount", async () => {
			const units = ethers.BigNumber.from(20)

			const buyConfig: BuyConfigStruct = {
				minimumUnits: units,
				desiredUnits: units,
				maximumPrice: BN(1).mul(units),
			};

			const buyerBalanceBefore = await getBalance(ZERO_ADDRESS, buyer1);

			const trx = await vapour721A.connect(buyer1).mintNFT(buyConfig, {value: buyConfig.maximumPrice});
			const gasUsed = await getGasUsed(trx);
			const buyerBalanceAfter = await getBalance(ZERO_ADDRESS, buyer1);

			expect(await vapour721A.balanceOf(buyer1.address)).to.equals(units);
			expect(buyerBalanceAfter.add(gasUsed)).to.equals(buyerBalanceBefore.sub(nftPrice.mul(units)))
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

			vapour721AConstructorConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 100,
				recipient: recipient.address,
				owner: owner.address,
				royaltyBPS: 1000
			};

			const deployTrx = await vapour721AFactory.createChildTyped(
				vapour721AConstructorConfig,
				ZERO_ADDRESS,
				vmStateConfig
			);

			const child = await getChild(vapour721AFactory, deployTrx);
			vapour721A = (await ethers.getContractAt("Vapour721A", child)) as Vapour721A;
		})

		it("should allow minting up to the supply limit", async () => {
			const units = ethers.BigNumber.from(vapour721AConstructorConfig.supplyLimit)

			const buyConfig: BuyConfigStruct = {
				minimumUnits: units,
				desiredUnits: units,
				maximumPrice: nftPrice.mul(units),
			};

			expect(await vapour721A.totalSupply()).to.equals(0)
			await vapour721A.connect(buyer1).mintNFT(buyConfig, {value: buyConfig.maximumPrice})

			expect(await vapour721A.balanceOf(buyer1.address)).to.equals(units)
			expect(await vapour721A.totalSupply()).to.equals(vapour721AConstructorConfig.supplyLimit)

		});

		it("should fail to buy after supply limit reached", async () => {
			const units = ethers.BigNumber.from(1)

			const buyConfig: BuyConfigStruct = {
				minimumUnits: units,
				desiredUnits: units,
				maximumPrice: nftPrice,
			};

			await expect(vapour721A.connect(buyer1).mintNFT(buyConfig)).to.revertedWith(
				"INSUFFICIENT_STOCK"
			);
		});

		it("should fail to buy beyond supplyLimit even after NFTs have been burned", async () => {
			await vapour721A.connect(buyer1).burn(1)

			expect(await vapour721A.balanceOf(buyer1.address)).to.equals(vapour721AConstructorConfig.supplyLimit as number - 1)
			expect(await vapour721A.totalSupply()).to.equals(vapour721AConstructorConfig.supplyLimit as number - 1)

			const units = ethers.BigNumber.from(1)

			const buyConfig: BuyConfigStruct = {
				minimumUnits: units,
				desiredUnits: units,
				maximumPrice: nftPrice,
			};

			await expect(vapour721A.connect(buyer1).mintNFT(buyConfig)).to.revertedWith(
				"INSUFFICIENT_STOCK"
			);
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

			vapour721AConstructorConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 100,
				recipient: recipient.address,
				owner: owner.address,
				royaltyBPS: 1000
			};

			const deployTrx = await vapour721AFactory.createChildTyped(
				vapour721AConstructorConfig,
				ZERO_ADDRESS,
				vmStateConfig
			);
			const child = await getChild(vapour721AFactory, deployTrx);
			vapour721A = (await ethers.getContractAt("Vapour721A", child)) as Vapour721A;
		});

		it("Should buy 1 NFT at zero price", async () => {
			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				maximumPrice: 0,
				desiredUnits: 1
			}
			await vapour721A.connect(buyer0).mintNFT(buyConfig);
			expect(await vapour721A.balanceOf(buyer0.address)).to.equals(1);
		});

		it("Should buy multiple NFTs at zero price", async () => {
			const buyConfig: BuyConfigStruct = {
				minimumUnits: 10,
				maximumPrice: 0,
				desiredUnits: 10
			}
			await vapour721A.connect(buyer1).mintNFT(buyConfig, {value: buyConfig.maximumPrice});
			expect(await vapour721A.balanceOf(buyer1.address)).to.equals(10);
		});
	});

	describe("revert tests", () => {
		before(async () => {
			nftPrice = parseEther('1')
			const vmStateConfig: StateConfig = {
				sources: [
					concat([
						op(VM.Opcodes.CONTEXT, 1), // always allow the target units
						op(VM.Opcodes.CONSTANT, 0)
					]),
				],
				constants: [nftPrice],
			};

			vapour721AConstructorConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 100,
				recipient: recipient.address,
				owner: owner.address,
				royaltyBPS: 1000
			};

			const deployTrx = await vapour721AFactory.createChildTyped(
				vapour721AConstructorConfig,
				ZERO_ADDRESS,
				vmStateConfig
			);
			const child = await getChild(vapour721AFactory, deployTrx);
			vapour721A = (await ethers.getContractAt("Vapour721A", child)) as Vapour721A;

			await currency.connect(buyer1).mintTokens(vapour721AConstructorConfig.supplyLimit)
			await currency.connect(buyer1).approve(vapour721A.address, nftPrice.mul(ethers.BigNumber.from(vapour721AConstructorConfig.supplyLimit)))
		});

		it("should revert if minimumUnits is 0", async () => {
			const buyConfig: BuyConfigStruct = {
				minimumUnits: 0,
				maximumPrice: 0,
				desiredUnits: 1
			}
			await expect(vapour721A.connect(buyer1).mintNFT(buyConfig, {value: buyConfig.maximumPrice})).to.revertedWith(
				"0_MINIMUM"
			);
		});

		it("should revert if minimumUnits > desiredUnits", async () => {
			const buyConfig: BuyConfigStruct = {
				minimumUnits: 2,
				maximumPrice: 0,
				desiredUnits: 1
			}

			await expect(vapour721A.connect(buyer1).mintNFT(buyConfig)).to.revertedWith(
				"MINIMUM_OVER_DESIRED"
			);
		});

		it("should revert if price is over maximumPrice", async () => {
			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				maximumPrice: nftPrice.div(ethers.BigNumber.from(2)),
				desiredUnits: 1
			}
			await expect(vapour721A.connect(buyer1).mintNFT(buyConfig)).to.revertedWith(
				"MAXIMUM_PRICE"
			);
		});

		it("should revert if minimum units exceeds current stock", async () => {
			// buy half the stock
			const buyer1Units = vapour721AConstructorConfig.supplyLimit as number / 2
			const buyer1Config: BuyConfigStruct = {
				minimumUnits: buyer1Units,
				maximumPrice: nftPrice.mul(buyer1Units),
				desiredUnits: buyer1Units
			}

			await vapour721A.connect(buyer1).mintNFT(buyer1Config, {value: buyer1Config.maximumPrice})
			expect(await vapour721A.totalSupply()).to.equals(buyer1Units)
			expect(await vapour721A.balanceOf(buyer1.address)).to.equals(buyer1Units)

			// attempt to buy more than the stock remaining
			const buyer2Units = vapour721AConstructorConfig.supplyLimit as number - buyer1Units + 1
			const buyer2Config: BuyConfigStruct = {
				minimumUnits: buyer2Units,
				maximumPrice: nftPrice,
				desiredUnits: buyer2Units
			}

			await expect(vapour721A.connect(buyer2).mintNFT(buyer2Config, {value: buyer2Config.maximumPrice})).to.revertedWith(
				"INSUFFICIENT_STOCK"
			);
		});
	});
});

