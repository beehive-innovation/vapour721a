import { expect } from "chai";
import { ethers } from "hardhat";
import { StateConfig } from "rain-sdk";
import {
	BuyConfigStruct,
	ConstructorConfigStruct,
	Rain721A,
} from "../../typechain/Rain721A";
import {
	buyer0,
	owner,
	rain721AFactory,
	recipient,
	currency,
} from "../1_setup";
import {
    BN,
	concat,
	eighteenZeros,
	getChild,
	op,
	Opcode,
	StorageOpcodes,
} from "../utils";

let rain721aConstructorConfig: ConstructorConfigStruct;
let rain721a: Rain721A;
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
    
            rain721aConstructorConfig = {
                name: "nft",
                symbol: "NFT",
                baseURI: "BASE_URI",
                supplyLimit: 100,
                recipient: recipient.address,
                owner: owner.address,
            };
    
            const deployTrx = await rain721AFactory.createChildTyped(
                rain721aConstructorConfig,
                currency.address,
                vmStateConfig
            );
            const child = await getChild(rain721AFactory, deployTrx);
            rain721a = (await ethers.getContractAt("Rain721A", child)) as Rain721A;
        });
    
        it("Should Buy 5 nft with erc20 token", async () => {
            await currency.connect(buyer0).mintTokens(5);
    
            await currency
                .connect(buyer0)
                .approve(rain721a.address, ethers.BigNumber.from(5 + eighteenZeros));
    
            const buyConfig: BuyConfigStruct = {
                minimumUnits: 1,
                desiredUnits: MAX_CAP,
                maximumPrice: ethers.BigNumber.from(MAX_CAP + eighteenZeros),
            };
    
            const trx = await rain721a.connect(buyer0).mintNFT(buyConfig);
    
            expect(await rain721a.balanceOf(buyer0.address)).to.equals(MAX_CAP);
        });
    
        it("Should fail to Buy nft above max cap", async () => {
            const units = 20;
    
            await currency.connect(buyer0).mintTokens(1 * units);
    
            await currency
                .connect(buyer0)
                .approve(rain721a.address, ethers.BigNumber.from(units + eighteenZeros));
    
            const buyConfig: BuyConfigStruct = {
                minimumUnits: 1,
                desiredUnits: 5,
                maximumPrice: ethers.BigNumber.from(1 + eighteenZeros),
            };
            await expect(rain721a.connect(buyer0).mintNFT(buyConfig)).to.revertedWith(
                "INSUFFICIENT_STOCK"
            );
    
            expect(await rain721a.balanceOf(buyer0.address)).to.equals(MAX_CAP);
        });
    });

    describe.only("Buy after timestamp test", () => {
        before(async () => {
            const block_before = await ethers.provider.getBlock('latest');
            const vmStateConfig: StateConfig = {
                sources: [
                    concat([
                        op(Opcode.BLOCK_TIMESTAMP), // current timestamp
                        op(Opcode.CONSTANT, 2), // given timestamp
                        op(Opcode.GREATER_THAN), // current_timestamp > given_timestamp
                        op(Opcode.CONSTANT, 1), // 100 units
                        op(Opcode.CONSTANT, 0), // 0 units
                        op(Opcode.EAGER_IF), // (current_timestamp > given_timestamp)? 100 : 0;
                        op(Opcode.CONSTANT, 3) // price 1 ETH
                    ]),
                ],
                constants: [0, 100, block_before.timestamp + 100 , BN(1)],
            };
    
            rain721aConstructorConfig = {
                name: "nft",
                symbol: "NFT",
                baseURI: "BASE_URI",
                supplyLimit: 100,
                recipient: recipient.address,
                owner: owner.address,
            };
    
            const deployTrx = await rain721AFactory.createChildTyped(
                rain721aConstructorConfig,
                currency.address,
                vmStateConfig
            );
            const child = await getChild(rain721AFactory, deployTrx);
            rain721a = (await ethers.getContractAt("Rain721A", child)) as Rain721A;
        });

        it("it Should return 0 Units",async () => {
            const [maxUnits_, price_] = await rain721a.calculateBuy(buyer0.address, 10);
            expect(maxUnits_).to.equals(ethers.BigNumber.from(0));
            expect(price_).to.equals(BN(1));
        });

        it("it Should return 100 Units",async () => {
            await ethers.provider.send("evm_increaseTime", [36000]);
            await ethers.provider.send("evm_mine",[]);
            const [maxUnits_, price_] = await rain721a.calculateBuy(buyer0.address, 10);
            expect(maxUnits_).to.equals(ethers.BigNumber.from(100));
            expect(price_).to.equals(BN(1));
        });
    });

    describe.only("Buy before timestamp test", () => {
        before(async () => {
            const block_before = await ethers.provider.getBlock('latest');
            const time = block_before.timestamp + 3600;
            const vmStateConfig: StateConfig = {
                sources: [
                    concat([
                        op(Opcode.BLOCK_TIMESTAMP), // current timestamp
                        op(Opcode.CONSTANT, 2), // given timestamp
                        op(Opcode.LESS_THAN), // current_timestamp < given_timestamp
                        op(Opcode.CONSTANT, 1), // 100 units
                        op(Opcode.CONSTANT, 0), // 0 units
                        op(Opcode.EAGER_IF), // (current_timestamp < given_timestamp)? 100 : 0;
                        op(Opcode.CONSTANT, 3) // price 1 ETH
                    ]),
                ],
                constants: [0, 100, time, BN(1)],
            };
    
            rain721aConstructorConfig = {
                name: "nft",
                symbol: "NFT",
                baseURI: "BASE_URI",
                supplyLimit: 100,
                recipient: recipient.address,
                owner: owner.address,
            };
    
            const deployTrx = await rain721AFactory.createChildTyped(
                rain721aConstructorConfig,
                currency.address,
                vmStateConfig
            );
            const child = await getChild(rain721AFactory, deployTrx);
            rain721a = (await ethers.getContractAt("Rain721A", child)) as Rain721A;
        });

        it("it Should return 100 Units",async () => {
            const [maxUnits_, price_] = await rain721a.calculateBuy(buyer0.address, 10);
            expect(maxUnits_).to.equals(ethers.BigNumber.from(100));
            expect(price_).to.equals(BN(1));
        });
        
        it("it Should return 0 Units",async () => {
            await ethers.provider.send("evm_increaseTime", [3600]);
            await ethers.provider.send("evm_mine",[]);
            const [maxUnits_, price_] = await rain721a.calculateBuy(buyer0.address, 10);
            expect(maxUnits_).to.equals(ethers.BigNumber.from(0));
            expect(price_).to.equals(BN(1));
        });

    });

    describe.only("Buy between timestamp test", () => {
        before(async () => {
            const block_before = await ethers.provider.getBlock('latest');
            const start_time = block_before.timestamp + 3600;
            const end_time = start_time + 3600;
            const vmStateConfig: StateConfig = {
                sources: [
                    concat([
                        op(Opcode.BLOCK_TIMESTAMP), // current timestamp
                        op(Opcode.CONSTANT, 3), // endTime_timestamp
                        op(Opcode.LESS_THAN), // current_timestamp < endTime_timestamp
                        op(Opcode.BLOCK_TIMESTAMP), // current timestamp
                        op(Opcode.CONSTANT, 2), // startTime_timestamp
                        op(Opcode.GREATER_THAN), // current_timestamp > startTime_timestamp
                        op(Opcode.EVERY, 2),
                        op(Opcode.CONSTANT, 1), // 100 units
                        op(Opcode.CONSTANT, 0), // 0 units
                        op(Opcode.EAGER_IF), // (current_timestamp < given_timestamp)? 100 : 0;
                        op(Opcode.CONSTANT, 4) // price 1 ETH
                    ]),
                ],
                constants: [0, 100, start_time, end_time, BN(1)],
            };
    
            rain721aConstructorConfig = {
                name: "nft",
                symbol: "NFT",
                baseURI: "BASE_URI",
                supplyLimit: 100,
                recipient: recipient.address,
                owner: owner.address,
            };
    
            const deployTrx = await rain721AFactory.createChildTyped(
                rain721aConstructorConfig,
                currency.address,
                vmStateConfig
            );
            const child = await getChild(rain721AFactory, deployTrx);
            rain721a = (await ethers.getContractAt("Rain721A", child)) as Rain721A;
        });
        it("it Should return 0 Units",async () => {
            const [maxUnits_, price_] = await rain721a.calculateBuy(buyer0.address, 10);
            expect(maxUnits_).to.equals(ethers.BigNumber.from(0));
            expect(price_).to.equals(BN(1));
        });

        it("it Should return 100 Units",async () => {
            await ethers.provider.send("evm_increaseTime", [3600]);
            await ethers.provider.send("evm_mine",[]);
            const [maxUnits_, price_] = await rain721a.calculateBuy(buyer0.address, 10);
            expect(maxUnits_).to.equals(ethers.BigNumber.from(100));
            expect(price_).to.equals(BN(1));
        });
        
        it("it Should return 0 Units",async () => {
            await ethers.provider.send("evm_increaseTime", [3600]);
            await ethers.provider.send("evm_mine",[]);
            const [maxUnits_, price_] = await rain721a.calculateBuy(buyer0.address, 10);
            expect(maxUnits_).to.equals(ethers.BigNumber.from(0));
            expect(price_).to.equals(BN(1));
        });

    });
});
