import { expect } from "chai";
import { BigNumber } from "ethers";
import { keccak256, randomBytes } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { condition, Conditions, price, Rain1155, Type } from "rain-game-sdk";
import { CommitEvent, ConstructorConfigStruct, InitializeConfigStruct, InitializeEvent, Rain721A, TimeBoundStruct } from "../../typechain/Rain721A";
import { buyer0, buyer1, buyer2, buyer3, buyer4, buyer5, buyer6, buyer7, config, owner, rain721aFactory, recipient, rTKN } from "../1_setup";
import { getChild, getEventArgs } from "../utils";

let rain721aConstructorConfig: ConstructorConfigStruct;
let rain721aInitializeConfig: InitializeConfigStruct;
let rain721a: Rain721A;
let secrets: Buffer[] = [];
let commitments: string[] = []; 

describe("Rain721A Commit tests", () => {
    before(async () => {
 
        const canMint: condition[] = [
            {
                type: Conditions.NONE
            }
        ];
    
        const prices: price[] = [
            {
                currency: {
                    type: Type.ERC20,
                    address: rTKN.address
                },
                amount: ethers.BigNumber.from("1" )
            }
        ];
    
        const [vmStateConfig_, currencies_] = Rain1155.generateScript([canMint], prices);
        
        const timeBound: TimeBoundStruct = {
            baseDuration: 60,
            maxExtraTime: 60
        }
    
        rain721aConstructorConfig = {
            name: "nft",
            symbol: "NFT",
            defaultURI: "DEFAULT_URI",
            baseURI: "BASE_URI",
            supplyLimit: 36,
            recipient: recipient.address,
            owner: owner.address,
            timeBound: timeBound
        }
    
        rain721aInitializeConfig = {
            vmStateBuilder: config.allStandardOpsStateBuilder,
            vmStateConfig: vmStateConfig_,
            currencies: currencies_,
        }

        let encodedConfig = ethers.utils.defaultAbiCoder.encode(
            [
              "tuple(string name, string symbol, string defaultURI, string baseURI, uint256 supplyLimit, address recipient, address owner, tuple(uint256 baseDuration, uint256 maxExtraTime) timeBound)",
            ],
            [rain721aConstructorConfig]
          );
        let createTrx = await rain721aFactory.createChild(encodedConfig);

        const child = await getChild(rain721aFactory, createTrx);

        rain721a = await ethers.getContractAt("Rain721A", child) as Rain721A;  
    });

    it("Should fail to Commit before initializing contract", async () => {
        const signers = await ethers.getSigners();
        let buyer0 = signers[0];

        const val = randomBytes(32);
        const commit = keccak256(val);

        await expect(rain721a.commit(commit, 1)).to.revertedWith("NOT_INITIALIZED");
    });

    it("Should be able to commit after initalization",async () => {
        let initTrx = await rain721a.initialize(rain721aInitializeConfig);

        const [ config_ ] = await getEventArgs(initTrx, "Initialize", rain721a) as InitializeEvent["args"];
        
        expect(config_.vmStateBuilder).to.equals(rain721aInitializeConfig.vmStateBuilder);
        expect(config_.currencies).to.deep.equals(rain721aInitializeConfig.currencies);

        
        
        for(let i=0;i<10;i++){
            let secret = randomBytes(32) as Buffer;
            secrets[i] = secret;
            commitments[i] = keccak256(secret);
        }

        await rTKN.connect(buyer0).mintTokens(1);
        await rTKN.connect(buyer1).mintTokens(2);
        await rTKN.connect(buyer2).mintTokens(3);
        await rTKN.connect(buyer3).mintTokens(4);
        await rTKN.connect(buyer4).mintTokens(5);
        await rTKN.connect(buyer5).mintTokens(6);
        await rTKN.connect(buyer6).mintTokens(7);
        await rTKN.connect(buyer7).mintTokens(8);

        await rTKN.connect(buyer0).approve(rain721a.address, 1);
        await rTKN.connect(buyer1).approve(rain721a.address, 2);
        await rTKN.connect(buyer2).approve(rain721a.address, 3);
        await rTKN.connect(buyer3).approve(rain721a.address, 4);
        await rTKN.connect(buyer4).approve(rain721a.address, 5);
        await rTKN.connect(buyer5).approve(rain721a.address, 6);
        await rTKN.connect(buyer6).approve(rain721a.address, 7);
        await rTKN.connect(buyer7).approve(rain721a.address, 8);

        await rain721a.connect(buyer1).commit(commitments[1], 2);
        await rain721a.connect(buyer2).commit(commitments[2], 3);
        await rain721a.connect(buyer3).commit(commitments[3], 4);
        await rain721a.connect(buyer4).commit(commitments[4], 5);
        await rain721a.connect(buyer5).commit(commitments[5], 6);
        await rain721a.connect(buyer6).commit(commitments[6], 7);
        await rain721a.connect(buyer7).commit(commitments[7], 8);

        const val = randomBytes(32);
        const commit = keccak256(val);

        const commitTrx = await rain721a.connect(buyer0).commit(commit, 1);

        const [ sender, commitment_] = await getEventArgs(commitTrx, "Commit", rain721a) as CommitEvent["args"];

        expect(sender).to.equals(buyer0.address);
        expect(commitment_.toBigInt()).to.equals(BigNumber.from(commit).toBigInt());
    });

    it("Should fail to commit after all Ids are reserved",async () => {
        const val = randomBytes(32);
        const commit = keccak256(val);

        await expect(rain721a.connect(buyer0).commit(commit, 1)).to.revertedWith("MAX_LIMIT");
    });
});
