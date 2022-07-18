import {assert, expect} from "chai";
import {ethers} from "hardhat";
import {StateConfig, VM} from "rain-sdk";
import {
	ConstructorConfigStruct,
	InitializeConfigStruct,
	Rain721A,
	WithdrawEvent,
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
	debug,
	eighteenZeros,
	getChild,
	getEventArgs,
	op,
	Opcode,
	StorageOpcodes,
	ZERO_ADDRESS,
} from "../utils";

let rain721aConstructorConfig: ConstructorConfigStruct;
let rain721aInitializeConfig: InitializeConfigStruct;
let rain721a: Rain721A;

const nftPrice = ethers.BigNumber.from("10" + eighteenZeros);

describe("Rain721a Withdraw test", () => {
	describe("NATIVE token Withdraw test", () => {
		before(async () => {
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

			const deployTrx = await rain721aFactory.createChildTyped(
				rain721aConstructorConfig,
				ZERO_ADDRESS,
				vmStateConfig
			);
			const child = await getChild(rain721aFactory, deployTrx);
			rain721a = (await ethers.getContractAt("Rain721A", child)) as Rain721A;
		});

		it("Should withdraw native token for 1 nft", async () => {
			const trx = await rain721a.connect(buyer0).mintNFT(1, {value: nftPrice});

			expect(await rain721a.balanceOf(buyer0.address)).to.equals(1);

			const before_balance = await ethers.provider.getBalance(
				recipient.address
			);

			const withdrawTrx = await rain721a.connect(recipient).withdraw();

			const [withdrawer, amountWithdrawn, totalWithdrawn] = (await getEventArgs(
				withdrawTrx,
				"Withdraw",
				rain721a
			)) as WithdrawEvent["args"];

			const after_balance = await ethers.provider.getBalance(recipient.address);

			expect(withdrawer).to.equals(recipient.address);
			expect(amountWithdrawn).to.equals(nftPrice);
			expect(totalWithdrawn).to.equals(nftPrice);
			assert(before_balance.lt(after_balance), "Not withdrawn");
		});

		it("Should withdraw native token for multiple token mint", async () => {
			const units = 20;
			const expectedAmountWithdrawn = nftPrice.mul(units);
			const expectedTotalWithdrawn = nftPrice.mul(units).add(nftPrice);

			const trx = await rain721a
				.connect(buyer1)
				.mintNFT(units, {value: nftPrice.mul(units)});

			expect(await rain721a.balanceOf(buyer1.address)).to.equals(20);

			const before_balance = await ethers.provider.getBalance(
				recipient.address
			);

			const withdrawTrx = await rain721a.connect(recipient).withdraw();

			const [withdrawer, amountWithdrawn, totalWithdrawn] = (await getEventArgs(
				withdrawTrx,
				"Withdraw",
				rain721a
			)) as WithdrawEvent["args"];

			const after_balance = await ethers.provider.getBalance(recipient.address);

			expect(withdrawer).to.equals(recipient.address);
			expect(amountWithdrawn).to.equals(expectedAmountWithdrawn);
			expect(totalWithdrawn).to.equals(expectedTotalWithdrawn);
			assert(before_balance.lt(after_balance), "Not withdrawn");
		});

		it("Should fail to withdraw 0 balance", async () => {
			await expect(rain721a.connect(recipient).withdraw()).to.revertedWith(
				"ZERO_FUND"
			);
		});

		it("Should fail to withdraw by non-recipient", async () => {
			await expect(rain721a.connect(buyer2).withdraw()).to.revertedWith(
				"RECIPIENT_ONLY"
			);
		});
	});

	describe("ERC20 token withdraw test", () => {
		before(async () => {
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
				supplyLimit: 20,
				recipient: recipient.address,
				owner: owner.address,
			};

			const deployTrx = await rain721aFactory.createChildTyped(
				rain721aConstructorConfig,
				rTKN.address,
				vmStateConfig
			);
			const child = await getChild(rain721aFactory, deployTrx);
			rain721a = (await ethers.getContractAt("Rain721A", child)) as Rain721A;
		});

		it("Should withdraw with erc20 token for 1 nft", async () => {
			await rTKN.connect(buyer0).mintTokens(10);

			await rTKN
				.connect(buyer0)
				.approve(rain721a.address, ethers.BigNumber.from(nftPrice));

			const trx = await rain721a.connect(buyer0).mintNFT(1);

			expect(await rain721a.balanceOf(buyer0.address)).to.equals(1);

			const before_balance = await rTKN.balanceOf(recipient.address);

			const withdrawTrx = await rain721a.connect(recipient).withdraw();

			const [withdrawer, amountWithdrawn, totalWithdrawn] = (await getEventArgs(
				withdrawTrx,
				"Withdraw",
				rain721a
			)) as WithdrawEvent["args"];

			const after_balance = await rTKN.balanceOf(recipient.address);

			expect(withdrawer).to.equals(recipient.address);
			expect(amountWithdrawn).to.equals(nftPrice);
			expect(totalWithdrawn).to.equals(nftPrice);
			expect(before_balance.add(nftPrice)).to.equals(after_balance);
		});

		it("Should withdraw with erc20 token for multiple buy", async () => {
			const units = 20;
			const expectedAmountWithdrawn = nftPrice.mul(units);
			const expectedTotalWithdrawn = expectedAmountWithdrawn.add(nftPrice);
			await rTKN.connect(buyer1).mintTokens(200);

			await rTKN
				.connect(buyer1)
				.approve(rain721a.address, ethers.BigNumber.from(nftPrice.mul(units)));

			const trx = await rain721a.connect(buyer1).mintNFT(units);

			expect(await rain721a.balanceOf(buyer1.address)).to.equals(units);

			const before_balance = await rTKN.balanceOf(recipient.address);

			const withdrawTrx = await rain721a.connect(recipient).withdraw();

			const [withdrawer, amountWithdrawn, totalWithdrawn] = (await getEventArgs(
				withdrawTrx,
				"Withdraw",
				rain721a
			)) as WithdrawEvent["args"];

			const after_balance = await rTKN.balanceOf(recipient.address);

			expect(withdrawer).to.equals(recipient.address);
			expect(amountWithdrawn).to.equals(expectedAmountWithdrawn);
			expect(totalWithdrawn).to.equals(expectedTotalWithdrawn);
			expect(before_balance.add(expectedAmountWithdrawn)).to.equals(
				after_balance
			);
		});
	});
});
