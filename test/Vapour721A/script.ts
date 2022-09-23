import { expect } from "chai";
import { BigNumber, Signer } from "ethers";
import { parseEther, parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { CombineTierGenerator, IncreasingPrice, StateConfig, utils, VM } from "rain-sdk";
import {
	ReserveToken,
	Token,
	Verify,
	VerifyFactory,
	VerifyTier,
	VerifyTierFactory,
} from "../../typechain";
import {
	BuyConfigStruct,
	ConstructorConfigStruct,
	Vapour721A,
} from "../../typechain/Vapour721A";
import {
	buyer0,
	buyer1,
	buyer2,
	buyer3,
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
	getPrice,
	op,
	Opcode
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
						op(Opcode.VAL, 0), // 5
						op(Opcode.ACCOUNT), // address of minter
						op(Opcode.IERC721A_NUMBER_MINTED),
						op(Opcode.SUB, 2),
						op(Opcode.SUPPLY_LIMIT),
						op(Opcode.IERC721A_TOTAL_SUPPLY),
						op(Opcode.SUB, 2),
						op(Opcode.MIN, 2),
						op(Opcode.VAL, 1),
					]),
				],
				constants: [MAX_CAP, ethers.BigNumber.from("1" + eighteenZeros)],
				stackLength: 10,
				argumentsLength: 0,
			};

			vapour721AConstructorConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 100,
				recipient: recipient.address,
				owner: owner.address,
				royaltyBPS: 1000,
				admin: buyer0.address,
			};

			const deployTrx = await vapour721AFactory.createChildTyped(
				vapour721AConstructorConfig,
				currency.address,
				vmStateConfig
			);
			const child = await getChild(vapour721AFactory, deployTrx);
			vapour721A = (await ethers.getContractAt(
				"Vapour721A",
				child
			)) as Vapour721A;
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
			await expect(
				vapour721A.connect(buyer0).mintNFT(buyConfig)
			).to.revertedWith("INSUFFICIENT_STOCK");

			expect(await vapour721A.balanceOf(buyer0.address)).to.equals(MAX_CAP);
		});
	});

	describe("Buy after timestamp test", () => {
		before(async () => {
			const block_before = await ethers.provider.getBlock("latest");

			const vmStateConfig: StateConfig = VM.pair(
				VM.ifelse(
					VM.beforeAfterTime(block_before.timestamp + 100, "gte"),
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
				royaltyBPS: 1000,
				admin: buyer0.address
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
				royaltyBPS: 1000,
				admin: buyer0.address
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
					VM.betweenTimes(start_time, end_time),
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
				royaltyBPS: 1000,
				admin: buyer0.address
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
		let start_time, end_time, start_price, end_price, priceChange;
		before(async () => {
			const block_before = await ethers.provider.getBlock("latest");

			start_time = block_before.timestamp;
			end_time = start_time + 3600 * 4; // 4 hours sale
			start_price = 1;
			end_price = 4;

			let raiseDuration = end_time - start_time;
			priceChange = (end_price - start_price) / (raiseDuration)

			vmStateConfig = VM.pair(
				VM.constant(100),
				new IncreasingPrice(
					start_price,
					end_price,
					start_time,
					end_time
				)
			)

			vapour721AConstructorConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 100,
				recipient: recipient.address,
				owner: owner.address,
				royaltyBPS: 1000,
				admin: buyer0.address
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
				start_time
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
				start_time
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
				start_time
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
				start_time
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

	describe("multi round sale", () => {
		before(async () => {

			// deplying factories
			const verifyFactory = await (await ethers.getContractFactory("VerifyFactory")).deploy() as VerifyFactory;
			const verifyTierFactory = await (await ethers.getContractFactory("VerifyTierFactory")).deploy() as VerifyTierFactory;

			// deploying verify1
			const verifyTx1 = await verifyFactory.createChildTyped({ admin: buyer0.address, callback: ethers.constants.AddressZero })
			const verifyAddress1 = await getChild(verifyFactory, verifyTx1)
			const verify1 = (await ethers.getContractAt("Verify", verifyAddress1)) as Verify;

			// deploying verify2
			const verifyTx2 = await verifyFactory.createChildTyped({ admin: buyer0.address, callback: ethers.constants.AddressZero })
			const verifyAddress2 = await getChild(verifyFactory, verifyTx2)
			const verify2 = (await ethers.getContractAt("Verify", verifyAddress2)) as Verify;

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
			const p2 = 5; // pre-sale price
			const p3 = 10; // sale price

			// function to get report script
			const getReport = (tierContractAddress: string): StateConfig => {
				return {
					constants: [tierContractAddress],
					sources: [
						concat([
							op(Opcode.VAL, 0),
							op(Opcode.ACCOUNT),
							op(Opcode.REPORT),
						])
					],
					stackLength: 3,
					argumentsLength: 0
				}
			}

			const vmStateConfig: StateConfig = VM.pair(
				// quantity script
				VM.ifelse(
					// rule 1
					VM.and([
						VM.beforeAfterTime(time1, "lt"),
						VM.hasAnyTier(
							getReport(verifyTierAddress1)
						)
					]),
					VM.constant(q1),
					VM.ifelse(
						//rule 2
						VM.and([
							VM.betweenTimes(time1, time2),
							VM.hasAnyTier(
								getReport(verifyTierAddress2)
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
							getReport(verifyTierAddress1)
						)
					]),
					VM.constant(p1),
					VM.ifelse(
						// rule 2
						VM.and([
							VM.betweenTimes(time1, time2),
							VM.hasAnyTier(
								getReport(verifyTierAddress2)
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
				royaltyBPS: 1000,
				admin: buyer0.address
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

	describe("increasing price per token sale", () => {

		const increasingPricePurchase = (
			units: BigNumber,
			totalMinted: BigNumber,
			priceIncrease: BigNumber,
			startingToken: number = 1
		): {
			unitPrice: BigNumber,
			totalCost: BigNumber
		} => {
			const bn = ethers.BigNumber
			// u = units
			// t = totalMinted
			// i = priceIncrease
			// s = startingToken
			// (u(2t - 2s + u + 3) / 2 * i)
			const totalCost =
				totalMinted
					.add(totalMinted)
					.sub(startingToken)
					.sub(startingToken)
					.add(units)
					.add(bn.from(3))
					.mul(units)
					.div(bn.from(2))
					.mul(priceIncrease)

			// divide by number of units to get the price per unit
			const unitPrice = totalCost.div(units)
			return { unitPrice, totalCost }
		}

		const increasingPricePurchaseSC = (
			priceIncrease: BigNumber,
			startingToken: number = 1,
			numberOfRules: number = 0
		): StateConfig => {
			return {
				sources: [
					concat([
						// (u(2t + u + 1) / 2 * i) / u
						op(Opcode.IERC721A_TOTAL_MINTED), // total minted
						op(Opcode.IERC721A_TOTAL_MINTED), // total minted

						op(Opcode.DUP, numberOfRules), // the eval of the q script

						op(Opcode.VAL, 0), // 3
						op(Opcode.ADD, 4),
						op(Opcode.VAL, 3), // starting token
						op(Opcode.VAL, 3), // starting token
						op(Opcode.SATURATING_SUB, 3),

						op(Opcode.DUP, numberOfRules), // the eval of the q script

						op(Opcode.MUL, 2),
						op(Opcode.VAL, 1), // 2
						op(Opcode.DIV, 2),
						op(Opcode.VAL, 2), // price increase
						op(Opcode.MUL, 2),

						op(Opcode.DUP, numberOfRules), // the eval of the q script
						op(Opcode.ISZERO),
						op(Opcode.VAL, 4),
						op(Opcode.DUP, numberOfRules), // the eval of the q script
						op(Opcode.EAGER_IF), // avoiding division by zero here

						op(Opcode.DIV, 2),
					])
				],
				constants: [3, 2, priceIncrease, startingToken, 1],
				stackLength: 25,
				argumentsLength: 0
			}
		}

		const zero = (): StateConfig => {
			return {
				sources: [
					concat([
						op(Opcode.VAL, 0)
					]),
				],
				constants: [0],
				stackLength: 1,
				argumentsLength: 0
			}
		}

		const tokenIsLessThan = (endToken: number): StateConfig => {
			return {
				sources: [
					concat([
						op(Opcode.IERC721A_TOTAL_MINTED),
						op(Opcode.TARGET_UNITS),
						op(Opcode.ADD, 2),
						op(Opcode.VAL, 0),
						op(Opcode.LESS_THAN),
					]),
				],
				constants: [endToken],
				stackLength: 5,
				argumentsLength: 0
			}
		}

		const tokenIsGreaterThan = (token: number): StateConfig => {
			return {
				sources: [
					concat([
						op(Opcode.IERC721A_TOTAL_MINTED),
						op(Opcode.TARGET_UNITS),
						op(Opcode.ADD, 2),
						op(Opcode.VAL, 0),
						op(Opcode.GREATER_THAN),
					]),
				],
				constants: [token],
				stackLength: 5,
				argumentsLength: 0
			}
		}

		const receiverAddressIsIn = (addresses: string[]): StateConfig => {
			return {
				sources: [
					concat([
						...addresses.map((address, i) =>
							concat([
								op(Opcode.ACCOUNT),
								op(Opcode.VAL, i),
								op(Opcode.EQUAL_TO)
							])
						),
						op(Opcode.ANY, addresses.length)
					])
				],
				constants: [...addresses],
				stackLength: (addresses.length * 3) + 5,
				argumentsLength: 0
			}
		}

		const maxCapForWallet = (cap: number): StateConfig => {
			return {
				sources: [
					concat([
						op(Opcode.VAL, 0), // cap
						op(Opcode.ACCOUNT), // address of minter
						op(Opcode.IERC721A_NUMBER_MINTED), // number they've minted
						op(Opcode.SATURATING_SUB, 2) // (the cap) - (what they've minted so far)
					])
				],
				constants: [cap],
				stackLength: 4,
				argumentsLength: 0
			}
		}

		const remainingUnits = (): StateConfig => {
			return {
				sources: [
					concat([
						op(Opcode.SUPPLY_LIMIT),
						op(Opcode.IERC721A_TOTAL_MINTED),
						op(Opcode.SATURATING_SUB, 2),
						op(Opcode.TARGET_UNITS), // units
						op(Opcode.MIN, 2)
					])
				],
				constants: [],
				stackLength: 5,
				argumentsLength: 0
			}
		}

		const rule = (number: number): StateConfig => {
			return {
				sources: [
					concat([
						op(Opcode.DUP, number)
					])
				],
				constants: [],
				stackLength: 1,
				argumentsLength: 0
			}
		}

		const generateWallets = async (number: number, name?: string): Promise<Signer[]> => {
			let wallets: Signer[] = []
			process.stdout.write(` `);
			for (let i = 0; i < number; i++) {
				process.stdout.write('\r\x1b[K');
				process.stdout.write(`${name}... `);
				process.stdout.write(`${i + 1}/${number}`);
				// Get a new wallet
				const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
				// send ETH to the new wallet so it can perform a tx
				await buyer0.sendTransaction({ to: wallet.address, value: ethers.utils.parseEther("1") });
				wallets.push(wallet)
			}
			process.stdout.write('\n');
			return wallets
		}

		const topupWallets = async (signers: Signer[], currency: Token, vapour721A: Vapour721A) => {
			let i = 1
			console.log('')
			console.log('=====')
			process.stdout.write('\n');
			for (const signer of signers) {
				process.stdout.write('\r\x1b[K');
				process.stdout.write(`\rminting currency for wallet ${i}...`)
				// get the wallet some tokens
				await currency.connect(signer).mintTokens(1000000)
				await currency.connect(signer).approve(vapour721A.address, parseEther('1000000'))
				i++
			}
			process.stdout.write('\n');
			console.log(' ')
		}

		const getSignerAddresses = async (signers: Signer[]): Promise<string[]> => {
			return await Promise.all(signers.map(async (signer) => await signer.getAddress()))
		}

		const mintForSigner = async (signer: Signer, buyConfig: BuyConfigStruct, currency: Token, vapour721A: Vapour721A) => {
			// desired units
			const units = ethers.BigNumber.from(buyConfig.desiredUnits)

			// get the expected price per unit
			const [maxUnits_, price_] = await vapour721A.connect(buyer0).calculateBuy(
				buyer0.address,
				units
			);

			const supply = await vapour721A.totalSupply()

			// how many they'll actually mint
			const maxUnits = supplyLimit.sub(supply).lt(units) ? supplyLimit.sub(supply) : units;

			const address = await signer.getAddress()
			const balanceBefore = await currency.balanceOf(address)
			await vapour721A.connect(signer).mintNFT(buyConfig)
			const balanceAfter = await currency.balanceOf(address)
			const total = balanceBefore.sub(balanceAfter)

			// make sure the correct amount was paid
			expect(total).to.equals(price_.mul(maxUnits))
		}

		//////////////////////////
		// config for this sale //
		//////////////////////////

		const supplyLimit = ethers.BigNumber.from(1111)
		const priceIncreasePerToken = parseEther('0.1'); // sale price
		const startingToken = 101

		const phase0cap = 5
		const phase1cap = 2
		const phase2cap = 1
		const phase3cap = 1

		let founders: Signer[], friends: Signer[], community: Signer[], anons: Signer[], everyone: Signer[]

		before(async () => {

			// create the wallets for each phase
			console.log('')
			console.log('generating wallets:')

			// founders = await generateWallets(2, 'founders')
			// friends = await generateWallets(5, 'friends')
			// community = await generateWallets(20, 'community')
			// anons = await generateWallets(60, 'anons')

			founders = await generateWallets(1, 'founders')
			friends = await generateWallets(1, 'friends')
			community = await generateWallets(1, 'community')
			anons = await generateWallets(1, 'anons')

			everyone = [...founders, ...friends, ...community, ...anons]

			// the conditions for each phase
			const rules = [
				// phase 0
				receiverAddressIsIn(await getSignerAddresses(founders)),
				// phase 1
				VM.and([
					tokenIsGreaterThan(10),
					receiverAddressIsIn(await getSignerAddresses(friends))
				]),
				// phase 2
				VM.and([
					tokenIsGreaterThan(20),
					receiverAddressIsIn(await getSignerAddresses(community))
				]),
				// phase 3
				tokenIsGreaterThan(40),
				// phase 4
				tokenIsGreaterThan(100),
				// rule 5 = phases 0 - 3
				tokenIsLessThan(101),
			]

			const vmStateConfig: StateConfig = VM.multi(
				[
					...rules,
					// quantity script
					VM.ifelse(
						rule(4),
						remainingUnits(),
						VM.ifelse(
							rule(3),
							maxCapForWallet(phase3cap),
							VM.ifelse(
								rule(2),
								maxCapForWallet(phase2cap),
								VM.ifelse(
									rule(1),
									maxCapForWallet(phase1cap),
									VM.ifelse(
										rule(0),
										maxCapForWallet(phase0cap),
										zero(),
										false
									),
									false
								),
								false
							),
							false
						),
						false
					),
					// price script
					VM.ifelse(
						rule(5),
						zero(),
						increasingPricePurchaseSC(priceIncreasePerToken, startingToken, rules.length),
						false
					),
				], false
			)

			vapour721AConstructorConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit,
				recipient: recipient.address,
				owner: owner.address,
				royaltyBPS: 1000,
				admin: buyer0.address
			};

			const deployTrx = await vapour721AFactory.connect(buyer0).createChildTyped(
				vapour721AConstructorConfig,
				currency.address,
				vmStateConfig
			);

			const child = await getChild(vapour721AFactory, deployTrx);
			vapour721A = (await ethers.getContractAt("Vapour721A", child)) as Vapour721A;

			// top up all the wallets
			await topupWallets(everyone, currency, vapour721A)

		});

		it.only("should mint for phase 0", async () => {

			const units = ethers.BigNumber.from(phase0cap)

			const buyConfig: BuyConfigStruct = {
				minimumUnits: units,
				desiredUnits: units,
				maximumPrice: 0,
			};

			const buyConfigLarge: BuyConfigStruct = {
				minimumUnits: 1000,
				desiredUnits: 1000,
				maximumPrice: parseUnits('1000'),
			};

			// make sure a non-founder can't mint
			await expect(vapour721A.connect(anons[0]).mintNFT(buyConfig)).to.revertedWith("INSUFFICIENT_STOCK")
			await expect(vapour721A.connect(anons[0]).mintNFT(buyConfigLarge)).to.revertedWith("INSUFFICIENT_STOCK")

			// price for founders should be 0
			const [maxUnits_, price_] = await vapour721A.connect(founders[0]).calculateBuy(
				await founders[0].getAddress(),
				units
			);

			expect(price_).to.equals(0)

			// make sure founders can't mint beyond their cap
			const [fmaxUnits_, fprice_] = await vapour721A.connect(founders[0]).calculateBuy(
				await founders[0].getAddress(),
				units.mul(BigNumber.from(100))
			);

			expect(fmaxUnits_).to.equals(0)

			let index = 0
			for (const signer of founders) {
				await mintForSigner(signer, buyConfig, currency, vapour721A)
				console.log(`minting #${(index * phase0cap) + 1}-${(index + 1) * phase0cap}/${founders.length * phase0cap} (phase 0)`)
				console.log(`${await vapour721A.totalSupply()} tokens minted so far`)
				console.log('=====')
				index++
			}
		})

		it("should mint for phase 1", async () => {

			const units = ethers.BigNumber.from(phase1cap)

			const buyConfig: BuyConfigStruct = {
				minimumUnits: units,
				desiredUnits: units,
				maximumPrice: 0,
			};

			// make sure a non-friend can't mint
			await expect(vapour721A.connect(anons[0]).mintNFT(buyConfig)).to.revertedWith("INSUFFICIENT_STOCK")

			// price for founders should be 0
			const [maxUnits_, price_] = await vapour721A.connect(founders[0]).calculateBuy(
				await founders[0].getAddress(),
				units
			);

			expect(price_).to.equals(0)

			let index = 0
			for (const signer of friends) {
				await mintForSigner(signer, buyConfig, currency, vapour721A)
				console.log(`minting #${(index * phase1cap) + 1}-${(index + 1) * phase1cap}/${friends.length * phase1cap} (phase 1)`)
				console.log(`${await vapour721A.totalSupply()} tokens minted so far`)
				console.log('=====')
				index++
			}
		})

		it("should mint for phase 2", async () => {

			const units = ethers.BigNumber.from(phase2cap)

			const buyConfig: BuyConfigStruct = {
				minimumUnits: units,
				desiredUnits: units,
				maximumPrice: 0,
			};

			// make sure a non-community can't mint
			await expect(vapour721A.connect(anons[0]).mintNFT(buyConfig)).to.revertedWith("INSUFFICIENT_STOCK")

			// price for community should be 0
			const [maxUnits_, price_] = await vapour721A.connect(founders[0]).calculateBuy(
				await founders[0].getAddress(),
				units
			);

			expect(price_).to.equals(0)

			let index = 0
			for (const signer of community) {
				await mintForSigner(signer, buyConfig, currency, vapour721A)
				console.log(`minting #${(index * phase2cap) + 1}-${(index + 1) * phase2cap}/${community.length * phase2cap} (phase 2)`)
				console.log(`${await vapour721A.totalSupply()} tokens minted so far`)
				console.log('=====')
				index++

			}
		})

		it("should mint for phase 3", async () => {

			const units = ethers.BigNumber.from(phase3cap)

			const buyConfig: BuyConfigStruct = {
				minimumUnits: units,
				desiredUnits: units,
				maximumPrice: 0,
			};

			console.log(`${await vapour721A.totalSupply()} tokens minted so far`)

			for (let index = 0; index < 60; index++) {
				const signer = anons[index % anons.length]
				await mintForSigner(signer, buyConfig, currency, vapour721A)
				console.log(`minting #${index + 1}/60 (phase 3)`)
				console.log(`${await vapour721A.totalSupply()} tokens minted so far`)
				console.log('=====')
			}
		})

		it("should give the correct price until the supply is sold out", async () => {
			let supply = await vapour721A.totalSupply()
			let buyerNum = 0

			while (supply.lt(supplyLimit)) {
				const units = ethers.BigNumber.from(Math.floor(Math.random() * 30) + 1)
				const buyerAddress = await everyone[buyerNum].getAddress()

				const maxUnits = supplyLimit.sub(supply).lt(units) ? supplyLimit.sub(supply) : units;

				const [maxUnits_, price_] = await vapour721A.connect(buyer0).calculateBuy(
					buyerAddress,
					maxUnits
				);

				const { unitPrice, totalCost } = increasingPricePurchase(maxUnits, supply, priceIncreasePerToken, startingToken)

				expect(maxUnits_).to.equals(maxUnits);
				expect(price_).to.equals(unitPrice);

				const buyConfig: BuyConfigStruct = {
					minimumUnits: 1,
					desiredUnits: units,
					maximumPrice: price_,
				};

				const balanceBefore = await currency.balanceOf(buyerAddress)

				await vapour721A.connect(everyone[buyerNum]).mintNFT(buyConfig)

				const balanceAfter = await currency.balanceOf(buyerAddress)

				const total = balanceBefore.sub(balanceAfter)
				expect(totalCost).to.equals(total)

				supply = await vapour721A.totalSupply()

				console.log(`minting ${units.toString()} tokens (phase 4)`)
				console.log(`average price: ${price_.toString()}`)
				console.log(`total cost: ${price_.mul(units).toString()}`)
				console.log(`${supply.toString()} tokens minted so far`)
				console.log('=====')

				buyerNum = (buyerNum + 1) % everyone.length
			}

			expect(await vapour721A.totalSupply()).to.equals(supplyLimit)

		});
	});
});
