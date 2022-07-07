import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { keccak256, randomBytes } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { condition, Conditions, price, Rain1155, Type } from "rain-game-sdk";
import { AllStandardOpsStateBuilder } from "../typechain/AllStandardOpsStateBuilder";
import { Rain721A, ConstructorConfigStruct, InitializeConfigStruct } from "../typechain/Rain721A";
import { Token } from "../typechain/Token";

export let rain721a: Rain721A;

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
export let rain721aConstructorConfig: ConstructorConfigStruct;
export let rain721aInitializeConfig: InitializeConfigStruct;
export let rTKN: Token;

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

        const Erc20 = await ethers.getContractFactory("Token");

        rTKN = await Erc20.deploy("Rain Token", "rTKN") as Token;
        await rTKN.deployed()

        const stateBuilderFactory = await ethers.getContractFactory(
            "AllStandardOpsStateBuilder"
          );
          const stateBuilder =
            (await stateBuilderFactory.deploy()) as AllStandardOpsStateBuilder;
          await stateBuilder.deployed();

        const rain721Contract = await ethers.getContractFactory("Rain721A");

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

        const [vmStateConfig, currencies] = Rain1155.generateScript([canMint], prices);

        rain721aConstructorConfig = {
            name: "nft",
            symbol: "NFT",
            baseURI: "BASE_URI",
            supplyLimit: 36,
            recipient: recipient.address,
            owner: owner.address,
        }

        rain721aInitializeConfig = {
            vmStateBuilder: stateBuilder.address,
            vmStateConfig: vmStateConfig,
            currencies: currencies,
        }

        rain721a = await rain721Contract.deploy(rain721aConstructorConfig) as Rain721A;
        await rain721a.deployed();

        await rain721a.initialize(rain721aInitializeConfig);
    });

    it("Should fail to initialize again", async () => {
        await expect(rain721a.initialize(rain721aInitializeConfig)).to.be.revertedWith("INITIALIZED");
    });

    it("Should deploy the Rain721A contract", async () => {
        expect(rain721a.address).to.not.null;
        expect(await rain721a.baseURI()).to.equals(rain721aConstructorConfig.baseURI);
        expect(await rain721a.supplyLimit()).to.equals(rain721aConstructorConfig.supplyLimit);
        expect(await rain721a.owner()).to.equals(rain721aConstructorConfig.owner);
    });

    it("8 buyers should be able to commit", async () => {
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

        await rain721a.connect(buyer0).mintNFT(1);
        await rain721a.connect(buyer1).mintNFT(2);
        await rain721a.connect(buyer2).mintNFT(3);
        await rain721a.connect(buyer3).mintNFT(4);
        await rain721a.connect(buyer4).mintNFT(5);
        await rain721a.connect(buyer5).mintNFT(6);
        await rain721a.connect(buyer6).mintNFT(7);
        await rain721a.connect(buyer7).mintNFT(8);
        
        expect(await rain721a.totalSupply()).to.equals(rain721aConstructorConfig.supplyLimit)
    });

    it("Should fail to mint - SUPPLY_LIMIT",async () => {
        await expect(rain721a.connect(owner).mintNFT(1)).to.be.revertedWith("MAX_LIMIT");
    });

    it("Should return correct tokenURIs",async () => {
        for(let i=1;i<=rain721aConstructorConfig.supplyLimit; i++){
            expect(await rain721a.tokenURI(i)).to.equals(`${rain721aConstructorConfig.baseURI}/${i}.json`)
        }
    });
});