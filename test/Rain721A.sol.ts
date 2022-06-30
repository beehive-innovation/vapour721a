import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect, should } from "chai";
import { keccak256, randomBytes } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { condition, Conditions, Rain1155 } from "rain-game-sdk";
import { AllStandardOpsStateBuilder } from "../typechain/AllStandardOpsStateBuilder";
import { Rain721A, ConstructorConfigStruct, TimeBoundStruct } from "../typechain/Rain721A";
import { ZERO_ADDRESS } from "./utils";

export let rain721a: Rain721A;
export let stateBuilder: AllStandardOpsStateBuilder;

export let recipient: SignerWithAddress,
    owner: SignerWithAddress,
    buyer0: SignerWithAddress,
    buyer1: SignerWithAddress,
    buyer2: SignerWithAddress,
    buyer3: SignerWithAddress,
    buyer4: SignerWithAddress,
    buyer5: SignerWithAddress,
    buyer6: SignerWithAddress,
    buyer7: SignerWithAddress

export let secrets: Buffer[] = [];
export let commitments: string[] = [];
export let rain721aConfig: ConstructorConfigStruct;

describe("Rain721A test", () => {
    before(async () => {
        const signers = await ethers.getSigners();
        recipient = signers[8];
        owner = signers[9];
        buyer0 = signers[0];
        buyer1 = signers[1];
        buyer2 = signers[2];
        buyer3 = signers[3];
        buyer4 = signers[4];
        buyer5 = signers[5];
        buyer6 = signers[6];
        buyer7 = signers[7];

        const stateBuilderFactory = await ethers.getContractFactory(
            "AllStandardOpsStateBuilder"
          );
          stateBuilder = await stateBuilderFactory.deploy() as AllStandardOpsStateBuilder;
          await stateBuilder.deployed();

        const rain721Contract = await ethers.getContractFactory("Rain721A");

        const canMint: condition[] = [
            {
                type: Conditions.NONE
            }
        ]

        const [vmStateConfig, currencies] = Rain1155.generateScript([canMint], []);

        rain721aConfig = {
            name: "nft",
            symbol: "NFT",
            defaultURI: "DEFAULT_URI",
            baseURI: "BASE_URI",
            supplyLimit: 36,
            recipient: recipient.address,
            vmStateBuilder: stateBuilder.address,
            vmStateConfig: vmStateConfig,
            currencies: currencies,
            owner: owner.address
        }

        rain721a = await rain721Contract.deploy(rain721aConfig) as Rain721A;
        await rain721a.deployed();
    });

    it("Should deploy the Rain721A contract", async () => {
        expect(rain721a.address).to.not.null;
        expect(await rain721a.defaultURI()).to.equals(rain721aConfig.defaultURI);
        expect(await rain721a.baseURI()).to.equals(rain721aConfig.baseURI);
        expect(await rain721a.supplyLimit()).to.equals(rain721aConfig.supplyLimit);
        expect(await rain721a.owner()).to.equals(rain721aConfig.owner);

        expect(await rain721a.shuffled()).to.equals(ZERO_ADDRESS);
    });

    it("10 buyers should be able to commit", async () => {
        for(let i=0;i<10;i++){
            let secret = randomBytes(32) as Buffer;
            secrets[i] = secret;
            commitments[i] = keccak256(secret);
        }
        await rain721a.connect(buyer0).commit(commitments[0], 1);
        await rain721a.connect(buyer1).commit(commitments[1], 2);
        await rain721a.connect(buyer2).commit(commitments[2], 3);
        await rain721a.connect(buyer3).commit(commitments[3], 4);
        await rain721a.connect(buyer4).commit(commitments[4], 5);
        await rain721a.connect(buyer5).commit(commitments[5], 6);
        await rain721a.connect(buyer6).commit(commitments[6], 7);
        await rain721a.connect(buyer7).commit(commitments[7], 8);
        
        expect(await rain721a.totalSupply()).to.equals(rain721aConfig.supplyLimit)
    });

    it("Should return default tokenURI",async () => {
        expect(await rain721a.tokenURI(1)).to.equals(rain721aConfig.defaultURI);
        expect(await rain721a.tokenURI(8)).to.equals(rain721aConfig.defaultURI);
        expect(await rain721a.tokenURI(16)).to.equals(rain721aConfig.defaultURI);
        expect(await rain721a.tokenURI(24)).to.equals(rain721aConfig.defaultURI);
        expect(await rain721a.tokenURI(32)).to.equals(rain721aConfig.defaultURI);
    });

    it("Should fail to mint - SUPPLY_LIMIT",async () => {
        await expect(rain721a.connect(owner).commit(commitments[0], 1)).to.be.revertedWith("MAX_LIMIT");
    });

    it("Should fail to reveal",async () => {
        await expect(rain721a.connect(buyer0).reveal(commitments[0])).to.be.revertedWith("CANT_REVEAL");
    });

    it("Should start a rain dance - start reveling ids",async () => {
        const initialSeed = randomBytes(32);
        const timeBound: TimeBoundStruct = {
            baseDuration: 60,
            maxExtraTime: 60
        }
        await rain721a.connect(owner).startReveal(initialSeed, timeBound); 
    });

    it("Should be able to reveal",async () => {
        await rain721a.connect(buyer0).reveal(secrets[0]);
        // console.log("Buyer0 revealed");
        await rain721a.connect(buyer1).reveal(secrets[1]);
        // console.log("Buyer1 revealed");
        await rain721a.connect(buyer2).reveal(secrets[2]);
        // console.log("Buyer2 revealed");
        await rain721a.connect(buyer3).reveal(secrets[3]);
        // console.log("Buyer3 revealed");
        await rain721a.connect(buyer4).reveal(secrets[4]);
        // console.log("Buyer4 revealed");
        await rain721a.connect(buyer5).reveal(secrets[5]);
        // console.log("Buyer5 revealed");
        await rain721a.connect(buyer6).reveal(secrets[6]);
        // console.log("Buyer6 revealed");
        await rain721a.connect(buyer7).reveal(secrets[7]);
        // console.log("Buyer7 revealed");
    });

    it("Should return random tokenURIs",async () => {
        await rain721a.connect(owner).revealIds();
        expect(await rain721a.shuffled()).to.not.equals(ZERO_ADDRESS);

        for(let i=1;i<=rain721aConfig.supplyLimit; i++)
            console.log(await rain721a.tokenURI(i), `TokenURI for TokenID ${i}`);
    });
});