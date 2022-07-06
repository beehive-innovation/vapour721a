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
describe("Rain721a tokenURI test", () => {
    before(async () => {
        const canMint: condition[] = [
            {
                type: Conditions.NONE
            }
        ];
    
        const prices: price[] = [];
    
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
            supplyLimit: 800,
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

        for(let i=0;i<10;i++){
            let secret = randomBytes(32) as Buffer;
            secrets[i] = secret;
            commitments[i] = keccak256(secret);
        }

        await rain721a.connect(buyer0).commit(commitments[0], 100);
        await rain721a.connect(buyer1).commit(commitments[1], 100);
        await rain721a.connect(buyer2).commit(commitments[2], 100);
        await rain721a.connect(buyer3).commit(commitments[3], 100);
        await rain721a.connect(buyer4).commit(commitments[4], 100);
        await rain721a.connect(buyer5).commit(commitments[5], 100);
        await rain721a.connect(buyer6).commit(commitments[6], 100);
        await rain721a.connect(buyer7).commit(commitments[7], 100);
        
        const val = randomBytes(32);
        const initialSeed_ = keccak256(val);
        await rain721a.connect(owner).startReveal(initialSeed_);

        rain721a.connect(buyer0).reveal(secrets[0]);

        await rain721a.connect(buyer1).reveal(secrets[1])
        await rain721a.connect(buyer2).reveal(secrets[2])
        await rain721a.connect(buyer3).reveal(secrets[3])
        await rain721a.connect(buyer4).reveal(secrets[4])
        await rain721a.connect(buyer5).reveal(secrets[5])
        await rain721a.connect(buyer6).reveal(secrets[6])
        await rain721a.connect(buyer7).reveal(secrets[7])
    });

    it("Should retrun defaultURI before", async () => {
       for(let i=1;i<=rain721aConstructorConfig.supplyLimit;i++)
        expect(await rain721a.tokenURI(i)).to.equals(rain721aConstructorConfig.defaultURI); 
    });

    it("Should return shuffled tokenURI", async () => {
        await rain721a.revealIds();
        let same = Number(0);
        for(let i=1;i<=rain721aConstructorConfig.supplyLimit;i++){
            if(await rain721a.tokenURI(i) == `${rain721aConstructorConfig.baseURI}/${i}.json`){
                same = same + 1;
            } 
        }
        console.log(`/t/t${same * 100 / parseFloat(rain721aConstructorConfig.supplyLimit.toString())}% tokenId same as reservedId`);
    });
});