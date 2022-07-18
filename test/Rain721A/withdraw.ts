import {expect} from "chai";
import {ethers} from "hardhat";
import {StateConfig, VM} from "rain-sdk";
import {
	BuyConfigStruct,
	ConstructorConfigStruct,
	InitializeConfigStruct,
	Rain721A,
	WithdrawEvent,
} from "../../typechain/Rain721A";
import {
	buyer0,
	buyer1,
	owner,
	rain721aFactory,
	recipient,
	rTKN,
} from "../1_setup";
import {BN, concat, eighteenZeros, getChild, getEventArgs, op} from "../utils";

let rain721aConstructorConfig: ConstructorConfigStruct;
let rain721a: Rain721A;

const nftPrice = ethers.BigNumber.from("1" + eighteenZeros);

describe("Rain721a Withdraw test", () => {
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
				supplyLimit: 21,
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
			await rTKN.connect(buyer0).approve(rain721a.address, BN(10));

			await rTKN
				.connect(buyer0)
				.approve(rain721a.address, ethers.BigNumber.from(nftPrice));

			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				desiredUnits: 1,
				maximumPrice: BN(10),
			};

			const trx = await rain721a.connect(buyer0).mintNFT(buyConfig);

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
			await rTKN.connect(buyer1).mintTokens(units);

			await rTKN.connect(buyer1).approve(rain721a.address, BN(units));

			const buyConfig: BuyConfigStruct = {
				minimumUnits: 1,
				desiredUnits: units,
				maximumPrice: BN(units),
			};

			const trx = await rain721a.connect(buyer1).mintNFT(buyConfig);

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
