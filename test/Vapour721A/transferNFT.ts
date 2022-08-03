import {ethers} from "hardhat";
import {
	Vapour721A,
	InitializeConfigStruct,
} from "../../typechain/Vapour721A";
import {
	concat,
	falseTransferScript,
	getChild,
	op,
	trueTransferScript,
	ZERO_ADDRESS,
} from "../utils";
import {expect} from "chai";
import {
	owner,
	vapour721AFactory,
	recipient,
	buyer0,
	buyer1,
    buyer2,
} from "../1_setup";
import {StateConfig, VM} from "rain-sdk";

let vapour721AInitializeConfig: InitializeConfigStruct;
let vapour721A: Vapour721A;

describe("Vapour721A transfer test", () => {
	describe("Should transfer with no condition", () => {
		before(async () => {
			const vmStateConfig: StateConfig = {
				sources: [
					concat([
						op(VM.Opcodes.CONSTANT, 0),
						op(VM.Opcodes.CONSTANT, 1),
					]),
				],
				constants: [36, 0],
			};

			vapour721AInitializeConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 36,
				recipient: recipient.address,
				owner: owner.address,
				royaltyBPS: 1000,
				admin: buyer0.address,
				vmStateConfig: VM.combiner(trueTransferScript, vmStateConfig, {
					numberOfSources: 0,
				}),
				currency: ZERO_ADDRESS,
			};

			const trx = await vapour721AFactory.createChildTyped(
				vapour721AInitializeConfig
			);
			const child = await getChild(vapour721AFactory, trx);

			vapour721A = (await ethers.getContractAt(
				"Vapour721A",
				child
			)) as Vapour721A;
		});

		it("Buyer1 Should be able to buy 10 nfts", async () => {
			await vapour721A
				.connect(buyer1)
				.mintNFT({minimumUnits: 10, desiredUnits: 10, maximumPrice: 0});
			expect(await vapour721A.balanceOf(buyer1.address)).to.equals(10);
		});

        it("Should be able to transfer without any condition",async () => {
            await vapour721A.connect(buyer1).transferFrom(buyer1.address, buyer2.address, 1);
            expect(await vapour721A.balanceOf(buyer2.address)).to.equals(1);
        });
	});

    describe("Should fail to transfer always", () => {
		before(async () => {
			const vmStateConfig: StateConfig = {
				sources: [
					concat([
						op(VM.Opcodes.CONSTANT, 0),
						op(VM.Opcodes.CONSTANT, 1),
					]),
				],
				constants: [36, 0],
			};

			vapour721AInitializeConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 36,
				recipient: recipient.address,
				owner: owner.address,
				royaltyBPS: 1000,
				admin: buyer0.address,
				vmStateConfig: VM.combiner(falseTransferScript, vmStateConfig, {
					numberOfSources: 0,
				}),
				currency: ZERO_ADDRESS,
			};

			const trx = await vapour721AFactory.createChildTyped(
				vapour721AInitializeConfig
			);
			const child = await getChild(vapour721AFactory, trx);

			vapour721A = (await ethers.getContractAt(
				"Vapour721A",
				child
			)) as Vapour721A;
		});

		it("Buyer1 Should be able to buy 10 nfts", async () => {
			await vapour721A
				.connect(buyer1)
				.mintNFT({minimumUnits: 10, desiredUnits: 10, maximumPrice: 0});
			expect(await vapour721A.balanceOf(buyer1.address)).to.equals(10);
		});

        it("Should fail to transfer",async () => {
            await expect(vapour721A.connect(buyer1).transferFrom(buyer1.address, buyer2.address, 1)).to.revertedWith("CANT_TRANSFER");
        });
	});

    describe("receiver cant have more than ", () => {
		before(async () => {
			const calculateBuyScript: StateConfig = {
				sources: [
					concat([
						op(VM.Opcodes.CONSTANT, 0),
						op(VM.Opcodes.CONSTANT, 1),
					]),
				],
				constants: [36, 0],
			};

            const transferScript: StateConfig = {
                sources: [
                    concat([
						op(VM.Opcodes.CONSTANT, 3), // 10
                        op(VM.Opcodes.CONSTANT, 0), // contract address
                        op(VM.Opcodes.CONTEXT, 0), // receiver address
                        op(VM.Opcodes.IERC721_BALANCE_OF), 
                        op(VM.Opcodes.CONSTANT, 2), // 1
						op(VM.Opcodes.ADD, 2),
						op(VM.Opcodes.LESS_THAN),
						op(VM.Opcodes.CONSTANT, 2),
						op(VM.Opcodes.CONSTANT, 1),
						op(VM.Opcodes.EAGER_IF)
                    ])
                ],
                constants: [vapour721A.address, 0, 1, 10]
            }



			vapour721AInitializeConfig = {
				name: "nft",
				symbol: "NFT",
				baseURI: "BASE_URI",
				supplyLimit: 36,
				recipient: recipient.address,
				owner: owner.address,
				royaltyBPS: 1000,
				admin: buyer0.address,
				vmStateConfig: VM.combiner(transferScript, calculateBuyScript, {
					numberOfSources: 0,
				}),
				currency: ZERO_ADDRESS,
			};

			const trx = await vapour721AFactory.createChildTyped(
				vapour721AInitializeConfig
			);
			const child = await getChild(vapour721AFactory, trx);

			vapour721A = (await ethers.getContractAt(
				"Vapour721A",
				child
			)) as Vapour721A;
		});

		it("Buyer1 & Buyer2 Should be able to buy 10 nfts", async () => {
			await vapour721A
				.connect(buyer1)
				.mintNFT({minimumUnits: 10, desiredUnits: 10, maximumPrice: 0});
			expect(await vapour721A.balanceOf(buyer1.address)).to.equals(10);

			await vapour721A
				.connect(buyer2)
				.mintNFT({minimumUnits: 10, desiredUnits: 10, maximumPrice: 0});
			expect(await vapour721A.balanceOf(buyer2.address)).to.equals(10);
		});

        it("Should fail to transfer",async () => {
            await expect(vapour721A.connect(buyer1).transferFrom(buyer1.address, buyer2.address, 1)).to.revertedWith("CANT_TRANSFER");
        });
	});
});
