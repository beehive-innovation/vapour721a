import { expect } from "chai";
import { randomBytes } from "crypto";
import { BigNumber } from "ethers";
import { keccak256 } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { condition, Conditions, price, Rain1155, Type } from "rain-game-sdk";
import { ConstructEvent, ConstructorConfigStruct, InitializeConfigStruct, Rain721A, RevealEvent, StartEvent, TimeBoundStruct } from "../../typechain/Rain721A";
import { buyer0, buyer1, buyer2, buyer3, buyer4, buyer5, buyer6, buyer7, config, owner, rain721aFactory, recipient, rTKN } from "../1_setup";
import { getChild, getEventArgs, ZERO_ADDRESS } from "../utils";

let rain721aConstructorConfig: ConstructorConfigStruct;
let rain721aInitializeConfig: InitializeConfigStruct;
let rain721a: Rain721A;

describe("Rain721A receipient test", () => {
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
    });

    it("Should set the correct receipient",async () => {
        const deployTrx = await rain721aFactory.createChildTyped(rain721aConstructorConfig, rain721aInitializeConfig);
        const child = await getChild(rain721aFactory, deployTrx);

        rain721a = await ethers.getContractAt("Rain721A", child) as Rain721A;

        const [ config_ ] = await getEventArgs(deployTrx, "Construct", rain721a) as ConstructEvent["args"];
        
        expect(config_.recipient).to.equals(rain721aConstructorConfig.recipient);
    });

    it("Should fail to change recipient by non-recipient user",async () => {
        await expect(rain721a.connect(buyer7).setRecipient(buyer1.address)).to.revertedWith("RECIPIENT_ONLY");
    });

    it("Should fail to change recipient to ZEROADDRESS",async () => {
        await expect(rain721a.connect(recipient).setRecipient(ZERO_ADDRESS)).to.revertedWith("INVALID_ADDRESS");
    });

    it("Should fail to change recipient to contract address",async () => {
        await expect(rain721a.connect(recipient).setRecipient(rTKN.address)).to.revertedWith("INVALID_ADDRESS");
    });
});