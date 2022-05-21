const { expect }  = require("chai");
const { ethers } = require("hardhat");

import { Rain721A, Rain721AConfigStruct } from "../typechain/Rain721A";
import type { Token } from "../typechain/Token";
import type { ReserveToken } from "../typechain/ReserveToken";
import type { ReserveTokenERC1155 } from "../typechain/ReserveTokenERC1155";
import type { ReserveTokenERC721 } from "../typechain/ReserveTokenERC721";
import type { ERC20BalanceTierFactory } from "../typechain/ERC20BalanceTierFactory";
import type { ERC20BalanceTier } from "../typechain/ERC20BalanceTier";
import type { Rain721AFactory } from "../typechain/Rain721AFactory";
import { Rain1155, price, condition, Type, Conditions } from "rain-game-sdk";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { eighteenZeros, getEventArgs, ZERO_ADDRESS} from "./utils"
import { artifacts } from "hardhat";
import { Contract } from "ethers";


const LEVELS = Array.from(Array(8).keys()).map((value) =>
  ethers.BigNumber.from(++value + eighteenZeros)
); // [1,2,3,4,5,6,7,8]

export let rain721a: Rain721A;
export let SDK: Rain1155;
export let factory: Rain721AFactory;
export let USDT: ReserveToken;

export let BNB: Token;
export let SOL: Token;
export let XRP: Token;
export let rTKN: Token;

export let BAYC: ReserveTokenERC721;

export let CARS: ReserveTokenERC1155;
export let PLANES: ReserveTokenERC1155;
export let SHIPS: ReserveTokenERC1155;

export let erc20BalanceTier: ERC20BalanceTier;

export let signer1: SignerWithAddress,
  creator: SignerWithAddress,
  buyer1: SignerWithAddress,
  buyer2: SignerWithAddress,
  buyer3: SignerWithAddress,
  buyer4: SignerWithAddress

before(async () => {
  const signers = await ethers.getSigners();
  signer1 = signers[0];
  creator = signers[1];
  buyer1 = signers[2];
  buyer2 = signers[3];

  SDK = new Rain1155(signer1.address, signer1); // for script generation only

  const Factory = await ethers.getContractFactory("Rain721AFactory");
  factory = await Factory.deploy();
  await factory.deployed();

  // const contract = await ethers.getContractFactory("Rain721A");

  const Erc20 = await ethers.getContractFactory("Token");
  const stableCoins = await ethers.getContractFactory("ReserveToken");
  const Erc721 = await ethers.getContractFactory("ReserveTokenERC721");
  const Erc1155 = await ethers.getContractFactory("ReserveTokenERC1155");
  
  USDT = await stableCoins.deploy();
  await USDT.deployed();
  BNB = await Erc20.deploy("Binance", "BNB");
  await BNB.deployed();
  SOL = await Erc20.deploy("Solana", "SOL");
  await SOL.deployed();
  XRP = await Erc20.deploy("Ripple", "XRP");
  await XRP.deployed();

  BAYC = await Erc721.deploy("Boared Ape Yatch Club", "BAYC");
  await BAYC.deployed()

  CARS = await Erc1155.deploy();
  await CARS.deployed();
  PLANES = await Erc1155.deploy();
  await PLANES.deployed();
  SHIPS = await Erc1155.deploy();
  await SHIPS.deployed();

  rTKN = await Erc20.deploy("Rain Token", "rTKN");
  await rTKN.deployed()

  const erc20BalanceTierFactoryFactory = await ethers.getContractFactory("ERC20BalanceTierFactory");
  const erc20BalanceTierFactory = (await erc20BalanceTierFactoryFactory.deploy()) as ERC20BalanceTierFactory & Contract;
  await erc20BalanceTierFactory.deployed();

  const tx = await erc20BalanceTierFactory.createChildTyped({
    erc20: rTKN.address,
    tierValues: LEVELS
  });

  erc20BalanceTier = new ethers.Contract(
    ethers.utils.hexZeroPad(
      ethers.utils.hexStripZeros(
        (await getEventArgs(tx, "NewChild", erc20BalanceTierFactory)).child
      ),
      20
    ),
    (await artifacts.readArtifact("ERC20BalanceTier")).abi,
    signer1
  ) as ERC20BalanceTier & Contract;

  await erc20BalanceTier.deployed();

  const priceConfig: price[] = [
    {
      currency: {
        type: Type.NATIVE,
        address: ZERO_ADDRESS
      },
      amount: ethers.BigNumber.from(10)
    },
    {
      currency: {
        type: Type.ERC20,
        address: USDT.address
      },
      amount: ethers.BigNumber.from("10")
    },
    {
      currency: {
        type: Type.ERC20,
        address: BNB.address
      },
      amount: ethers.BigNumber.from("20")
    },
    {
      currency: {
        type: Type.ERC1155,
        address: CARS.address,
        tokenId: ethers.BigNumber.from("1")
      },
      amount: ethers.BigNumber.from("10")
    },
    {
      currency: {
        type: Type.ERC1155,
        address: PLANES.address,
        tokenId: ethers.BigNumber.from("2")
      },
      amount: ethers.BigNumber.from("20")
    },
  ];

  const canMintConfig: condition[] = [
    {
      type: Conditions.BLOCK_NUMBER,
      blockNumber: 10,
    },
    {
      type: Conditions.BALANCE_TIER,
      tierAddress: erc20BalanceTier.address,
      tierCondition: 4
    },
    {
      type: Conditions.ERC20BALANCE,
      address: SOL.address,
      balance: ethers.BigNumber.from("10" + eighteenZeros)
    },
    {
      type: Conditions.ERC1155BALANCE,
      address: SHIPS.address,
      balance: ethers.BigNumber.from("10"),
      id: ethers.BigNumber.from(1)
    },
    {
      type: Conditions.ERC721BALANCE,
      address: BAYC.address,
      balance: ethers.BigNumber.from(0)
    }
  ];

  const [ priceScript, currencies ]  = SDK.generatePriceScript(priceConfig);
  const canMintScript = SDK.generateCanMintScript(canMintConfig);

  const config: Rain721AConfigStruct = {
    name: "Rain721A",
    symbol: "RAIN",
    canMintScript: canMintScript,
    priceScript: priceScript,
    currencies: currencies,
    recipient: creator.address
  };

  let newChild = await factory.createChild(config);
  const [rain721aAddress, sender] = await getEventArgs(newChild, "NewChild", factory, factory.address);
  console.log({rain721aAddress, sender})

  rain721a = new ethers.Contract(rain721aAddress, (await artifacts.readArtifact("Rain721A")).abi, signer1)
  await rain721a.deployed();
})

describe("Rain721A test", () => {
    it("Should deploy Rain721A contract", async () => {
        expect(rain721a.address).to.be.not.null;
    });

    it("Should mint 1 nft", async () => {

      // Price
      await USDT.connect(buyer1).mintTokens(10);
      await BNB.connect(buyer1).mintTokens(20);
      await CARS.connect(buyer1).mintTokens(1, 10);
      await PLANES.connect(buyer1).mintTokens(2, 20);

      // Allow tokens
      await USDT.connect(buyer1).approve(rain721a.address, ethers.BigNumber.from(10));
      await BNB.connect(buyer1).approve(rain721a.address, ethers.BigNumber.from(20));

      await CARS.connect(buyer1).setApprovalForAll(rain721a.address, true);
      await PLANES.connect(buyer1).setApprovalForAll(rain721a.address, true);

      // Minting conditions
      await rTKN.connect(buyer1).mintTokens(5);
      await SOL.connect(buyer1).mintTokens(11);
      await SHIPS.connect(buyer1).mintTokens(1,11);
      await BAYC.connect(buyer1).mintNewToken();

      await rain721a.connect(buyer1).mint(1, {value: ethers.BigNumber.from(10)});

      expect(await rain721a.balanceOf(buyer1.address)).to.deep.equals(ethers.BigNumber.from(1));
      expect(await rain721a.totalSupply()).to.deep.equals(ethers.BigNumber.from(1));

    });

    it("Should buy 10 nfts",async () => {
       // Price
       await USDT.connect(buyer2).mintTokens(10 * 10);
       await BNB.connect(buyer2).mintTokens(20 * 10);
       await CARS.connect(buyer2).mintTokens(1, 10 * 10);
       await PLANES.connect(buyer2).mintTokens(2, 20 * 10);
 
       // Allow tokens
       await USDT.connect(buyer2).approve(rain721a.address, ethers.BigNumber.from(10 * 10));
       await BNB.connect(buyer2).approve(rain721a.address, ethers.BigNumber.from(20 * 10));
 
       await CARS.connect(buyer2).setApprovalForAll(rain721a.address, true);
       await PLANES.connect(buyer2).setApprovalForAll(rain721a.address, true);

        // Minting conditions
      await rTKN.connect(buyer2).mintTokens(5);
      await SOL.connect(buyer2).mintTokens(11);
      await SHIPS.connect(buyer2).mintTokens(1,11);
      await BAYC.connect(buyer2).mintNewToken();
 
      await rain721a.connect(buyer2).mint(10, {value: ethers.BigNumber.from(10 * 10)});

      expect(await rain721a.balanceOf(buyer2.address)).to.deep.equals(ethers.BigNumber.from(10))
      expect(await rain721a.totalSupply()).to.deep.equals(ethers.BigNumber.from(11));
    });

    it("Should check the owners",async () => {
      expect(await rain721a.ownerOf(1)).to.equals(buyer1.address);

      expect(await rain721a.ownerOf(2)).to.equals(buyer2.address);
      expect(await rain721a.ownerOf(6)).to.equals(buyer2.address);
      expect(await rain721a.ownerOf(11)).to.equals(buyer2.address);
    })
});