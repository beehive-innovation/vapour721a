import { ethers } from "hardhat";
import { Rain721A, TimeBoundStruct, ConstructorConfigStruct, InitializeConfigStruct, InitializeEvent } from "../../typechain/Rain721A";
import { getChild, getEventArgs, ZERO_ADDRESS } from "../utils";
import { condition, Conditions, price, Rain1155, Type } from "rain-game-sdk";
import { assert } from "console";
import { expect } from "chai";
import { config, owner, rain721aFactory, recipient, rTKN } from "../1_setup";
 
let rain721aConstructorConfig: ConstructorConfigStruct;
let rain721aInitializeConfig: InitializeConfigStruct;
let rain721a: Rain721A;

describe("Rain721A Initialise test", () => {
    it("Should deploy Rain721A Contract and Initialise",async () => {
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

        const trx = await rain721aFactory.createChildTyped(rain721aConstructorConfig, rain721aInitializeConfig);
        const child = await getChild(rain721aFactory, trx);

        rain721a = await ethers.getContractAt("Rain721A", child) as Rain721A;

        assert(child != ZERO_ADDRESS, "Rain721A Address not find");
        const [ config_] = await getEventArgs(trx, "Initialize", rain721a) as InitializeEvent["args"];
        assert(config_.vmStateBuilder == config.allStandardOpsStateBuilder, "Worng stateBuilder address");
        expect(config_.currencies).to.deep.equals(currencies_);
    });

    it("SHould fail to initialize again.",async () => {
        await expect(rain721a.initialize(rain721aInitializeConfig)).to.revertedWith("INITIALIZED");
    });

    it("Should be able to Initialize after creating with createChild memthod",async () => {
        let encodedConfig = ethers.utils.defaultAbiCoder.encode(
            [
              "tuple(string name, string symbol, string defaultURI, string baseURI, uint256 supplyLimit, address recipient, address owner, tuple(uint256 baseDuration, uint256 maxExtraTime) timeBound)",
            ],
            [rain721aConstructorConfig]
          );
        let createTrx = await rain721aFactory.createChild(encodedConfig);

        let child = await getChild(rain721aFactory, createTrx);

        rain721a = await ethers.getContractAt("Rain721A", child) as Rain721A;

        let intializeTrx = await rain721a.initialize(rain721aInitializeConfig);

        const [config_] = await getEventArgs(intializeTrx, "Initialize", rain721a) as InitializeEvent["args"];

        assert(child != ZERO_ADDRESS, "Rain721A Address not find");
        assert(config_.vmStateBuilder == config.allStandardOpsStateBuilder, "Worng stateBuilder address");
        expect(config_.currencies).to.deep.equals(rain721aInitializeConfig.currencies);
    });

    it("Should fain to initialed rain721a contract deployed by createChild method",async () => {
        await expect(rain721a.initialize(rain721aInitializeConfig)).to.revertedWith("INITIALIZED");
    });
});