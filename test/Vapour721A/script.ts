import { expect } from "chai";
import { ethers } from "hardhat";
import { BetweenTimestamps, CombineTierGenerator, IncDecPrice, StateConfig, utils, VM } from "rain-sdk";
import { Verify, VerifyFactory, VerifyTier, VerifyTierFactory } from "../../typechain";
import {
	BuyConfigStruct,
	ConstructorConfigStruct,
	Vapour721A,
} from "../../typechain/Vapour721A";
import { buyer0, owner, vapour721AFactory, recipient, currency } from "../1_setup";
import {
	BN,
	concat,
	eighteenZeros,
	getChild,
	getPrice,
	op,
	Opcode,
	StorageOpcodes,
} from "../utils";


let vapour721AConstructorConfig: ConstructorConfigStruct;
let vapour721A: Vapour721A;
const MAX_CAP = 5;

describe("Script Tests", () => {
	describe("MAX_CAP per user test", () => {
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

		it("Should Buy 5 nft with erc20 token", async () => {
			await currency.connect(buyer0).mintTokens(5);

			await currency
				.connect(buyer0)
				.approve(vapour721A.address, ethers.BigNumber.from(5 + eighteenZeros));

			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				desiredUnits: MAX_CAP,
				maximumPrice: ethers.BigNumber.from(MAX_CAP + eighteenZeros),
			};

			const trx = await vapour721A.connect(buyer0).mintNFT(buyConfig);

			expect(await vapour721A.balanceOf(buyer0.address)).to.equals(MAX_CAP);
		});

		it("Should fail to Buy nft above max cap", async () => {
			const units = 20;

			await currency.connect(buyer0).mintTokens(1 * units);

			await currency
				.connect(buyer0)
				.approve(
					vapour721A.address,
					ethers.BigNumber.from(units + eighteenZeros)
				);

			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				desiredUnits: 5,
				maximumPrice: ethers.BigNumber.from(1 + eighteenZeros),
			};
			await expect(vapour721A.connect(buyer0).mintNFT(buyConfig)).to.revertedWith(
				"INSUFFICIENT_STOCK"
			);

			expect(await vapour721A.balanceOf(buyer0.address)).to.equals(MAX_CAP);
		});
	});

	describe("Buy after timestamp test", () => {
		before(async () => {
			const block_before = await ethers.provider.getBlock("latest");

			const vmStateConfig: StateConfig = VM.pair(
				VM.ifelse(
					VM.beforeAfterTime(block_before.timestamp +  100, "gte"),
					VM.constant(100),
					VM.constant(0)
				),
				VM.constant(BN(1))
			)

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

		it("it Should return 0 Units", async () => {
			const [maxUnits_, price_] = await vapour721A.calculateBuy(
				buyer0.address,
				10
			);
			expect(maxUnits_).to.equals(ethers.BigNumber.from(0));
			expect(price_).to.equals(BN(1));
		});

		it("it Should return 100 Units", async () => {
			await ethers.provider.send("evm_increaseTime", [36000]);
			await ethers.provider.send("evm_mine", []);
			const [maxUnits_, price_] = await vapour721A.calculateBuy(
				buyer0.address,
				10
			);
			expect(maxUnits_).to.equals(ethers.BigNumber.from(100));
			expect(price_).to.equals(BN(1));
		});
	});

	describe("Buy before timestamp test", () => {
		before(async () => {
			const block_before = await ethers.provider.getBlock("latest");
			const time = block_before.timestamp + 3600;

			const vmStateConfig: StateConfig = VM.pair(
				VM.ifelse(
					VM.beforeAfterTime(time, "lte"),
					VM.constant(100),
					VM.constant(0)
				),
				VM.constant(BN(1))
			)

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

		it("it Should return 100 Units", async () => {
			const [maxUnits_, price_] = await vapour721A.calculateBuy(
				buyer0.address,
				10
			);
			expect(maxUnits_).to.equals(ethers.BigNumber.from(100));
			expect(price_).to.equals(BN(1));
		});

		it("it Should return 0 Units", async () => {
			await ethers.provider.send("evm_increaseTime", [3600]);
			await ethers.provider.send("evm_mine", []);
			const [maxUnits_, price_] = await vapour721A.calculateBuy(
				buyer0.address,
				10
			);
			expect(maxUnits_).to.equals(ethers.BigNumber.from(0));
			expect(price_).to.equals(BN(1));
		});
	});

	describe("Buy between timestamp test", () => {
		before(async () => {
			const block_before = await ethers.provider.getBlock("latest");
			const start_time = block_before.timestamp + 3600;
			const end_time = start_time + 3600;

			const vmStateConfig: StateConfig = VM.pair(
				VM.ifelse(
					new BetweenTimestamps(start_time, end_time),
					VM.constant(100),
					VM.constant(0)
				),
				VM.constant(BN(1))
			) 

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
		it("it Should return 0 Units", async () => {
			const [maxUnits_, price_] = await vapour721A.calculateBuy(
				buyer0.address,
				10
			);
			expect(maxUnits_).to.equals(ethers.BigNumber.from(0));
			expect(price_).to.equals(BN(1));
		});

		it("it Should return 100 Units", async () => {
			await ethers.provider.send("evm_increaseTime", [3600]);
			await ethers.provider.send("evm_mine", []);
			const [maxUnits_, price_] = await vapour721A.calculateBuy(
				buyer0.address,
				10
			);
			expect(maxUnits_).to.equals(ethers.BigNumber.from(100));
			expect(price_).to.equals(BN(1));
		});

		it("it Should return 0 Units", async () => {
			await ethers.provider.send("evm_increaseTime", [3600]);
			await ethers.provider.send("evm_mine", []);
			const [maxUnits_, price_] = await vapour721A.calculateBuy(
				buyer0.address,
				10
			);
			expect(maxUnits_).to.equals(ethers.BigNumber.from(0));
			expect(price_).to.equals(BN(1));
		});
	});

	describe("Buy with increasing price", () => {
		let vmStateConfig: StateConfig;
		let start_time, end_time, start_price, end_price, priceChange, isInc;
		before(async () => {
			const block_before = await ethers.provider.getBlock("latest");

			start_time = block_before.timestamp;
			end_time = start_time + 3600 * 4; // 4 hours sale
			start_price = 1;
			end_price = 4;

			isInc = end_price >= (start_time) ? true : false;
			let raiseDuration = end_time - start_time;
			priceChange = isInc
				? (end_price - start_price) / (raiseDuration)
				: (start_price - end_price) / (raiseDuration);

			vmStateConfig = VM.pair(
				VM.constant(100),
				new IncDecPrice(
					start_price,
					end_price,
					start_time,
					end_time,
				)
			)

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

		it("it Should return correct price for first hour", async () => {
			const expected_price_ = await getPrice(
				start_price,
				end_price,
				priceChange,
				start_time,
				isInc
			);

			const [maxUnits_, price_] = await vapour721A.calculateBuy(
				buyer0.address,
				10
			);
			expect(maxUnits_).to.equals(ethers.BigNumber.from(100));
			expect(price_).to.equals(expected_price_);
		});

		it("it Should return correct price for second hour", async () => {
			await ethers.provider.send("evm_increaseTime", [3600]);
			await ethers.provider.send("evm_mine", []);
			const expected_price_ = await getPrice(
				start_price,
				end_price,
				priceChange,
				start_time,
				isInc
			);

			const [maxUnits_, price_] = await vapour721A.calculateBuy(
				buyer0.address,
				10
			);
			expect(maxUnits_).to.equals(ethers.BigNumber.from(100));
			expect(price_).to.equals(expected_price_);
		});

		it("it Should return correct price for third hour", async () => {
			await ethers.provider.send("evm_increaseTime", [3600]);
			await ethers.provider.send("evm_mine", []);
			const expected_price_ = await getPrice(
				start_price,
				end_price,
				priceChange,
				start_time,
				isInc
			);

			const [maxUnits_, price_] = await vapour721A.calculateBuy(
				buyer0.address,
				10
			);
			expect(maxUnits_).to.equals(ethers.BigNumber.from(100));
			expect(price_).to.equals(expected_price_);
		});

		it("it Should return correct price for fourth hour", async () => {
			await ethers.provider.send("evm_increaseTime", [3600]);
			await ethers.provider.send("evm_mine", []);
			const expected_price_ = await getPrice(
				start_price,
				end_price,
				priceChange,
				start_time,
				isInc
			);
			const [maxUnits_, price_] = await vapour721A.calculateBuy(
				buyer0.address,
				10
			);
			expect(maxUnits_).to.equals(ethers.BigNumber.from(100));
			expect(price_).to.equals(expected_price_);
		});

		it("it Should return correct price for fifth hour", async () => {
			await ethers.provider.send("evm_increaseTime", [3600]);
			await ethers.provider.send("evm_mine", []);
			const [maxUnits_, price_] = await vapour721A.calculateBuy(
				buyer0.address,
				10
			);
			expect(maxUnits_).to.equals(ethers.BigNumber.from(100));
			expect(price_).to.equals(utils.parseUnits(end_price.toString()));
		});
	});

	describe("Buy before timestamp test", () => {
		before(async () => {

			// deplying factories
			const verifyFactory = await (await ethers.getContractFactory("VerifyFactory")).deploy() as VerifyFactory;   
			const verifyTierFactory = await (await ethers.getContractFactory("VerifyTierFactory")).deploy() as VerifyTierFactory;

			// deploying verify1
			const verifyTx1 = await verifyFactory.createChildTyped({admin: buyer0.address, callback:ethers.constants.AddressZero })
			const verifyAddress1 = await getChild(verifyFactory, verifyTx1)
			const verify1  = (await ethers.getContractAt("Verify", verifyAddress1)) as Verify;

			// deploying verify2
			const verifyTx2 = await verifyFactory.createChildTyped({admin: buyer0.address, callback:ethers.constants.AddressZero })
			const verifyAddress2 = await getChild(verifyFactory, verifyTx2)
			const verify2  = (await ethers.getContractAt("Verify", verifyAddress2)) as Verify;
			
			// deploying verifyTier1
			const verifyTierTx1 = await verifyTierFactory.createChildTyped(verify1.address)
			const verifyTierAddress1 = await getChild(verifyTierFactory, verifyTierTx1)

			// deploying verifyTier2
			const verifyTierTx2 = await verifyTierFactory.createChildTyped(verify2.address)
			const verifyTierAddress2 = await getChild(verifyTierFactory, verifyTierTx2)
			
			// Grant approver role to buyer0
			await verify1.connect(buyer0).grantRole(await verify1.APPROVER(), buyer0.address);
			
			// Approving buyer0
			await verify1.connect(buyer0).approve([{ account: buyer0.address, data: [] }]);
			
			// Grant approver role to buyer0
			await verify2.connect(buyer0).grantRole(await verify2.APPROVER(), buyer0.address);

			// Approving buyer0
			await verify2.connect(buyer0).approve([{ account: buyer0.address, data: [] }]);


			const block_before = await ethers.provider.getBlock("latest");

			let time1 = block_before.timestamp + 3600; // 1 hour exclusive round
			let time2 = time1 + 3600 * 4; // 4 hours pre-sale

			const q1 = 100; // exclusive round mint quantity
			const q2 = 50; // pre-sale round quantity
			const q3 = 5; // sale quantity

			const p1 = 1; // exclusive round price
			const p2 = 5; // pre-sale quantity
			const p3 = 10; // sale quantity

			const vmStateConfig: StateConfig = VM.pair(
				// quantity script
				VM.ifelse(
					// rule 1
					VM.and([
						VM.beforeAfterTime(time1, "lt"),
						VM.hasAnyTier(
							new CombineTierGenerator(verifyTierAddress1)
						)
					]),
					VM.constant(q1),
					VM.ifelse(
						//rule 2
						VM.and([
							new BetweenTimestamps(time1, time2),
							VM.hasAnyTier(
								new CombineTierGenerator(verifyTierAddress2)
							)
						]),
						VM.constant(q2),
						VM.constant(q3)
					)
				),
				// price script
				VM.ifelse(
					// rule 1
					VM.and([
						VM.beforeAfterTime(time1, "lt"),
						VM.hasAnyTier(
							new CombineTierGenerator(verifyTierAddress1)
						)
					]),
					VM.constant(p1),
					VM.ifelse(
						// rule 2
						VM.and([
							new BetweenTimestamps(time1, time2),
							VM.hasAnyTier(
								new CombineTierGenerator(verifyTierAddress2)
							)
						]),
						VM.constant(p2),
						VM.constant(p3)
					)
				)
			)
			
			vapour721AConstructorConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 100,
				recipient: recipient.address,
				owner: owner.address,
				royaltyBPS: 1000
			};

			const deployTrx = await vapour721AFactory.connect(buyer0).createChildTyped(
				vapour721AConstructorConfig,
				currency.address,
				vmStateConfig
			);
			
			const child = await getChild(vapour721AFactory, deployTrx);
			vapour721A = (await ethers.getContractAt("Vapour721A", child)) as Vapour721A;
		});

		it("it Should return 100 Units for exclusive round", async () => {
			const [maxUnits_, price_] = await vapour721A.connect(buyer0).calculateBuy(
				buyer0.address,
				10
			);
			expect(maxUnits_).to.equals(ethers.BigNumber.from(100));
			expect(price_).to.equals(1);
		});

		it("it Should return 50 Units for pre-sale round", async () => {
			await ethers.provider.send("evm_increaseTime", [3700]);
			await ethers.provider.send("evm_mine", []);
			const [maxUnits_, price_] = await vapour721A.connect(buyer0).calculateBuy(
				buyer0.address,
				10
			);
			expect(maxUnits_).to.equals(ethers.BigNumber.from(50));
			expect(price_).to.equals(5);
	 	});

		 it("it Should return 5 Units for sale", async () => {
			await ethers.provider.send("evm_increaseTime", [3700 * 4]);
			await ethers.provider.send("evm_mine", []);
			const [maxUnits_, price_] = await vapour721A.connect(buyer0).calculateBuy(
				buyer0.address,
				10
			);
			expect(maxUnits_).to.equals(ethers.BigNumber.from(5));
			expect(price_).to.equals(10);
	 	});
	 });
});
