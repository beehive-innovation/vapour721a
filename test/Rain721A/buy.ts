import {expect} from "chai";
import {ethers} from "hardhat";
import {condition, Conditions, price, Rain1155, Type} from "rain-game-sdk";
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
	buyer3,
	buyer4,
	buyer5,
	buyer6,
	buyer7,
	config,
	gameAsset,
	owner,
	rain721aFactory,
	recipient,
	rTKN,
} from "../1_setup";
import {concat, eighteenZeros, getChild, op, ZERO_ADDRESS} from "../utils";

let rain721aConstructorConfig: ConstructorConfigStruct;
let rain721aInitializeConfig: InitializeConfigStruct;
let rain721a: Rain721A;

describe("Rain721a Buy test", () => {
	describe("NATIVE token test", () => {
		before(async () => {
			const vmStateConfig: StateConfig = {
				sources: [
					concat([
						op(VM.Opcodes.CONSTANT, 0),
						op(VM.Opcodes.CONSTANT, 1),
						op(VM.Opcodes.CONSTANT, 2),
					]),
				],
				constants: [1, 0, ethers.BigNumber.from("1" + eighteenZeros)],
			};

			rain721aConstructorConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 800,
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
			const recipientBlalance_before = await ethers.provider.getBalance(
				recipient.address
			);
			const trx = await rain721a
				.connect(buyer0)
				.mintNFT(1, {value: ethers.BigNumber.from("1" + eighteenZeros)});

			expect(await rain721a.balanceOf(buyer0.address)).to.equals(1);
			expect(
				recipientBlalance_before.add(ethers.BigNumber.from("1" + eighteenZeros))
			).to.equals(await ethers.provider.getBalance(recipient.address));
		});

		it("Should Buy multiple nft with native token", async () => {
			const recipientBlalance_before = await ethers.provider.getBalance(
				recipient.address
			);

			const units = 20;

			const trx = await rain721a
				.connect(buyer1)
				.mintNFT(units, {value: ethers.BigNumber.from(units + eighteenZeros)});

			expect(await rain721a.balanceOf(buyer1.address)).to.equals(20);
			expect(
				recipientBlalance_before.add(
					ethers.BigNumber.from(units + eighteenZeros)
				)
			).to.equals(await ethers.provider.getBalance(recipient.address));
		});
	});

	describe("ERC20 token test", () => {
		before(async () => {
			const vmStateConfig: StateConfig = {
				sources: [
					concat([
						op(VM.Opcodes.CONSTANT, 0),
						op(VM.Opcodes.CONSTANT, 1),
						op(VM.Opcodes.CONSTANT, 2),
					]),
				],
				constants: [1, 1, ethers.BigNumber.from("1" + eighteenZeros)],
			};

			rain721aConstructorConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 800,
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

			const recipientBlalance_before = await rTKN.balanceOf(recipient.address);

			await rTKN
				.connect(buyer0)
				.approve(rain721a.address, ethers.BigNumber.from(1 + eighteenZeros));

			const trx = await rain721a.connect(buyer0).mintNFT(1);

			expect(await rain721a.balanceOf(buyer0.address)).to.equals(1);
			expect(
				recipientBlalance_before.add(ethers.BigNumber.from("1" + eighteenZeros))
			).to.equals(await rTKN.balanceOf(recipient.address));
		});

		it("Should Buy multiple nft with erc20 token", async () => {
			const units = 20;

			await rTKN.connect(buyer1).mintTokens(1 * units);

			const recipientBlalance_before = await rTKN.balanceOf(recipient.address);

			await rTKN
				.connect(buyer1)
				.approve(
					rain721a.address,
					ethers.BigNumber.from(units + eighteenZeros)
				);

			const trx = await rain721a.connect(buyer1).mintNFT(units);

			expect(await rain721a.balanceOf(buyer1.address)).to.equals(20);
			expect(
				recipientBlalance_before.add(
					ethers.BigNumber.from(units + eighteenZeros)
				)
			).to.equals(await rTKN.balanceOf(recipient.address));
		});
	});

	describe("ERC1155 token test", () => {
		before(async () => {
			const vmStateConfig: StateConfig = {
				sources: [
					concat([
						op(VM.Opcodes.CONSTANT, 0),
						op(VM.Opcodes.CONSTANT, 1),
						op(VM.Opcodes.CONSTANT, 2),
						op(VM.Opcodes.CONSTANT, 3),
					]),
				],
				constants: [1, 2, 1, 5],
			};

			rain721aConstructorConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 800,
				recipient: recipient.address,
				owner: owner.address,
			};

			rain721aInitializeConfig = {
				vmStateBuilder: config.allStandardOpsStateBuilder,
				vmStateConfig: vmStateConfig,
				currency: gameAsset.address,
			};

			const deployTrx = await rain721aFactory.createChildTyped(
				rain721aConstructorConfig,
				rain721aInitializeConfig
			);
			const child = await getChild(rain721aFactory, deployTrx);
			rain721a = (await ethers.getContractAt("Rain721A", child)) as Rain721A;
		});

		it("Should Buy 1 nft with erc1155 token", async () => {
			await gameAsset.connect(buyer0).mintTokens(1, 5);

			const recipientBlalance_before = await gameAsset.balanceOf(
				recipient.address,
				1
			);

			await gameAsset.connect(buyer0).setApprovalForAll(rain721a.address, true);

			const trx = await rain721a.connect(buyer0).mintNFT(1);

			expect(await rain721a.balanceOf(buyer0.address)).to.equals(1);
			expect(recipientBlalance_before.add(5)).to.equals(
				await gameAsset.balanceOf(recipient.address, 1)
			);
		});

		it("Should Buy multiple nft with erc1155 token", async () => {
			const units = 20;
			await gameAsset.connect(buyer1).mintTokens(1, 5 * units);

			const recipientBlalance_before = await gameAsset.balanceOf(
				recipient.address,
				1
			);

			await gameAsset.connect(buyer1).setApprovalForAll(rain721a.address, true);

			const trx = await rain721a.connect(buyer1).mintNFT(units);

			expect(await rain721a.balanceOf(buyer1.address)).to.equals(units);
			expect(recipientBlalance_before.add(5 * units)).to.equals(
				await gameAsset.balanceOf(recipient.address, 1)
			);
		});
	});
});
