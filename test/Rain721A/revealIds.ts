import { expect } from "chai";
import { randomBytes } from "crypto";
import { BigNumber } from "ethers";
import { keccak256 } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { condition, Conditions, price, Rain1155, Type } from "rain-game-sdk";
import { ConstructorConfigStruct, InitializeConfigStruct, Rain721A, RevealEvent, StartEvent, TimeBoundStruct } from "../../typechain/Rain721A";
import { buyer0, buyer1, buyer2, buyer3, buyer4, buyer5, buyer6, buyer7, config, owner, rain721aFactory, recipient, rTKN } from "../1_setup";
import { getChild, getEventArgs, ZERO_ADDRESS } from "../utils";

let rain721aConstructorConfig: ConstructorConfigStruct;
let rain721aInitializeConfig: InitializeConfigStruct;
let rain721a: Rain721A;
let secrets: Buffer[] = [];
let commitments: string[] = [];
describe("Rain721a revealIds test", () => {
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

        const deployTrx = await rain721aFactory.createChildTyped(rain721aConstructorConfig, rain721aInitializeConfig);
        const child = await getChild(rain721aFactory, deployTrx);

        rain721a = await ethers.getContractAt("Rain721A", child) as Rain721A;
        expect(await rain721a.callStatic.shuffled()).to.equals(ZERO_ADDRESS);
    });

    it("Should fail to revealIds before all Ids reserved and revealed", async () => {
        await expect(rain721a.connect(buyer0).revealIds()).to.revertedWith("CANT_REVEAL_IDS");
    });

    it("Should let everyone to commit",async () => {
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

        await rain721a.connect(buyer0).commit(commitments[0], 1);
        await rain721a.connect(buyer1).commit(commitments[1], 2);
        await rain721a.connect(buyer2).commit(commitments[2], 3);
        await rain721a.connect(buyer3).commit(commitments[3], 4);
        await rain721a.connect(buyer4).commit(commitments[4], 5);
        await rain721a.connect(buyer5).commit(commitments[5], 6);
        await rain721a.connect(buyer6).commit(commitments[6], 7);
        await rain721a.connect(buyer7).commit(commitments[7], 8);
        
        expect(await rain721a.totalSupply()).to.equals(rain721aConstructorConfig.supplyLimit)

        const val = randomBytes(32);
        const initialSeed_ = keccak256(val);
        const revealTrx = await rain721a.connect(owner).startReveal(initialSeed_);

        const [sender, initialSeed] = await getEventArgs(revealTrx, "Start",rain721a) as StartEvent["args"]
        expect(sender).to.equals(owner.address);
        expect(initialSeed.toBigInt()).to.equals(BigNumber.from(initialSeed_).toBigInt());
    });

    it("All buyers should be able to reveal with correct Secret", async () => {
        const reavealTrx =  await rain721a.connect(buyer0).reveal(secrets[0]);

        const [sender, secret, newSeed] = await getEventArgs(reavealTrx, "Reveal", rain721a) as RevealEvent["args"];

        expect(sender).to.equals(buyer0.address);
        expect(secret).to.equals(secrets[0]);
        expect(newSeed).to.not.null;

        await rain721a.connect(buyer1).reveal(secrets[1])
        await rain721a.connect(buyer2).reveal(secrets[2])
        await rain721a.connect(buyer3).reveal(secrets[3])
        await rain721a.connect(buyer4).reveal(secrets[4])
        await rain721a.connect(buyer5).reveal(secrets[5])
        await rain721a.connect(buyer6).reveal(secrets[6])
        await rain721a.connect(buyer7).reveal(secrets[7])
    });

    it("Should be able to revealIds",async () => {
        const revealTrx = await rain721a.revealIds();
        expect(await rain721a.callStatic.shuffled).to.not.equals(ZERO_ADDRESS);
    });
});