import {expect} from "chai";
import {ethers} from "hardhat";
import {StateConfig, VM} from "rain-sdk";
import {
	ConstructorConfigStruct,
	InitializeConfigStruct,
	Rain721A,
} from "../../typechain/Rain721A";
import {
	buyer0,
	buyer1,
	buyer2,
	config,
	owner,
	rain721aFactory,
	recipient,
	rTKN,
} from "../1_setup";
import {
	concat,
	eighteenZeros,
	getChild,
	op,
	Opcode,
	StorageOpcodes,
	ZERO_ADDRESS,
} from "../utils";

let rain721aConstructorConfig: ConstructorConfigStruct;
let rain721aInitializeConfig: InitializeConfigStruct;
let rain721a: Rain721A;

describe.only("Rain721a Buy test", () => {
	describe("NATIVE token test", () => {
		before(async () => {
			const vmStateConfig: StateConfig = {
				sources: [
					concat([op(VM.Opcodes.CONSTANT, 0), op(VM.Opcodes.CONSTANT, 1)]),
				],
				constants: [20, ethers.BigNumber.from("1" + eighteenZeros)],
			};

			rain721aConstructorConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 100,
				recipient: recipient.address,
				owner: owner.address,
			};

			rain721aInitializeConfig = {
				vmStateBuilder: config.allStandardOpsStateBuilder,
				vmStateConfig: vmStateConfig,
				currency: ZERO_ADDRESS,
			};

			const deployTrx = await rain721aFactory.createChildTyped(
				rain721aConstructorConfig,
				rain721aInitializeConfig
			);
			const child = await getChild(rain721aFactory, deployTrx);
			rain721a = (await ethers.getContractAt("Rain721A", child)) as Rain721A;
		});

		it("Should Buy 1 nft with native token", async () => {
			const trx = await rain721a
				.connect(buyer0)
				.mintNFT(1, {value: ethers.BigNumber.from("1" + eighteenZeros)});

			expect(await rain721a.balanceOf(buyer0.address)).to.equals(1);
		});

		it("Should Buy multiple nft with native token", async () => {
			const units = 20;

			const trx = await rain721a
				.connect(buyer1)
				.mintNFT(units, {value: ethers.BigNumber.from(units + eighteenZeros)});

			expect(await rain721a.balanceOf(buyer1.address)).to.equals(20);
		});
	});

	describe("ERC20 token test", () => {
		before(async () => {
			const vmStateConfig: StateConfig = {
				sources: [
					concat([op(VM.Opcodes.CONSTANT, 0), op(VM.Opcodes.CONSTANT, 1)]),
				],
				constants: [20, ethers.BigNumber.from("1" + eighteenZeros)],
			};

			rain721aConstructorConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 100,
				recipient: recipient.address,
				owner: owner.address,
			};

			rain721aInitializeConfig = {
				vmStateBuilder: config.allStandardOpsStateBuilder,
				vmStateConfig: vmStateConfig,
				currency: rTKN.address,
			};

			const deployTrx = await rain721aFactory.createChildTyped(
				rain721aConstructorConfig,
				rain721aInitializeConfig
			);
			const child = await getChild(rain721aFactory, deployTrx);
			rain721a = (await ethers.getContractAt("Rain721A", child)) as Rain721A;
		});

		it("Should Buy 1 nft with erc20 token", async () => {
			await rTKN.connect(buyer0).mintTokens(1);

			await rTKN
				.connect(buyer0)
				.approve(rain721a.address, ethers.BigNumber.from(1 + eighteenZeros));

			const trx = await rain721a.connect(buyer0).mintNFT(1);

			expect(await rain721a.balanceOf(buyer0.address)).to.equals(1);
		});

		it("Should Buy multiple nft with erc20 token", async () => {
			const units = 20;

			await rTKN.connect(buyer1).mintTokens(1 * units);

			await rTKN
				.connect(buyer1)
				.approve(
					rain721a.address,
					ethers.BigNumber.from(units + eighteenZeros)
				);

			const trx = await rain721a.connect(buyer1).mintNFT(units);

			expect(await rain721a.balanceOf(buyer1.address)).to.equals(20);
		});
	});

	describe.only("Should fail to buy more than supply Limit", () => {
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
				constants: [ethers.BigNumber.from(1 + eighteenZeros), 1],
			};

			rain721aConstructorConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 1,
				recipient: recipient.address,
				owner: owner.address,
			};

			rain721aInitializeConfig = {
				vmStateBuilder: config.allStandardOpsStateBuilder,
				vmStateConfig: vmStateConfig,
				currency: ZERO_ADDRESS,
			};

			const deployTrx = await rain721aFactory.createChildTyped(
				rain721aConstructorConfig,
				rain721aInitializeConfig
			);
			const child = await getChild(rain721aFactory, deployTrx);
			rain721a = (await ethers.getContractAt("Rain721A", child)) as Rain721A;

			await rain721a.connect(buyer2).mintNFT(1);

			expect(await rain721a.balanceOf(buyer2.address)).to.equals(1);
			expect(await rain721a.totalSupply()).to.equals(1);
		});

		it("should fail to buy after supply limit reached", async () => {
			await expect(rain721a.connect(buyer1).mintNFT(1)).to.revertedWith(
				"MAX_LIMIT"
			);
		});
	});
});
