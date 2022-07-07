import { expect } from "chai";
import { ethers } from "hardhat";
import { condition, Conditions, price, Rain1155 } from "rain-game-sdk";
import { ConstructorConfigStruct, InitializeConfigStruct, Rain721A } from "../../typechain/Rain721A";
import { buyer0, buyer1, buyer2, buyer3, buyer4, buyer5, buyer6, buyer7, config, owner, rain721aFactory, recipient } from "../1_setup";
import { getChild } from "../utils";

let rain721aConstructorConfig: ConstructorConfigStruct;
let rain721aInitializeConfig: InitializeConfigStruct;
let rain721a: Rain721A;

describe("Rain721a tokenURI test", () => {
    before(async () => {
        const canMint: condition[] = [
            {
                type: Conditions.NONE
            }
        ];
    
        const prices: price[] = [];
    
        const [vmStateConfig_, currencies_] = Rain1155.generateScript([canMint], prices);
    
        rain721aConstructorConfig = {
            name: "nft",
            symbol: "NFT",
            baseURI: "BASE_URI",
            supplyLimit: 800,
            recipient: recipient.address,
            owner: owner.address,
        }
    
        rain721aInitializeConfig = {
            vmStateBuilder: config.allStandardOpsStateBuilder,
            vmStateConfig: vmStateConfig_,
            currencies: currencies_,
        }

        const deployTrx = await rain721aFactory.createChildTyped(rain721aConstructorConfig, rain721aInitializeConfig);
        const child = await getChild(rain721aFactory, deployTrx);

        rain721a = await ethers.getContractAt("Rain721A", child) as Rain721A;

        await rain721a.connect(buyer0).mintNFT(100);
        await rain721a.connect(buyer1).mintNFT(100);
        await rain721a.connect(buyer2).mintNFT(100);
        await rain721a.connect(buyer3).mintNFT(100);
        await rain721a.connect(buyer4).mintNFT(100);
        await rain721a.connect(buyer5).mintNFT(100);
        await rain721a.connect(buyer6).mintNFT(100);
        await rain721a.connect(buyer7).mintNFT(100);
    });

    it("Should retrun correct tokenURI", async () => {
       for(let i=1;i<=rain721aConstructorConfig.supplyLimit;i++)
       expect(await rain721a.tokenURI(i)).to.equals(`${rain721aConstructorConfig.baseURI}/${i}.json`)
 
    });
});