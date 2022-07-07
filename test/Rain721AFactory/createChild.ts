import { Rain721AFactory } from "../../typechain/Rain721AFactory";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import {
  ConstructorConfigStruct,
  InitializeConfigStruct,
} from "../../typechain/Rain721A";
import { eighteenZeros, getEventArgs } from "../utils";
import { checkChildIntegrity } from "./childIntegrity";

import { expect } from "chai";
import { AllStandardOpsStateBuilder } from "../../typechain/AllStandardOpsStateBuilder";
import { condition, Conditions, price, Rain1155, Type } from "rain-game-sdk";
import { ReserveToken } from "../../typechain/ReserveToken";
import { Token } from "../../typechain/Token";
export let rain721AFactory: Rain721AFactory;

export let factoryDeployer: SignerWithAddress,
  signer1: SignerWithAddress,
  signer2: SignerWithAddress,
  recipient_: SignerWithAddress,
  owner_: SignerWithAddress

let constructorConfig: ConstructorConfigStruct;
let initializeConfig: InitializeConfigStruct;

let encodedConfig;

let stateBuilder: AllStandardOpsStateBuilder;
let USDT: Token;

beforeEach(async () => {
  const signers = await ethers.getSigners();
  factoryDeployer = signers[0];
  signer1 = signers[1];
  signer2 = signers[2];
  recipient_ = signers[3];
  owner_ = signers[4];

  const stableCoins = await ethers.getContractFactory("ReserveToken");

    USDT = await stableCoins.deploy() as ReserveToken;
    await USDT.deployed();
    
  const stateBuilderFactory = await ethers.getContractFactory(
    "AllStandardOpsStateBuilder"
  );
  stateBuilder = await stateBuilderFactory.deploy() as AllStandardOpsStateBuilder;
  await stateBuilder.deployed();

  const Rain721AFactory = await ethers.getContractFactory(
    "Rain721AFactory"
  );

  rain721AFactory = (await Rain721AFactory.connect(
    factoryDeployer
  ).deploy()) as Rain721AFactory;

  expect(rain721AFactory.address).to.be.not.null;
  constructorConfig = {
    name: "rain721a",
    symbol: "RAIN721A",
    baseURI: "BASE_URI",
    supplyLimit: 1000,
    recipient: recipient_.address,
    owner: owner_.address,
  };

  const priceConfig: price[] = [
    {
      currency: {
        type: Type.ERC20,
        address: USDT.address
      },
      amount: ethers.BigNumber.from("10" + eighteenZeros)
    }
  ];

  const canMintConfig: condition[] = [
    {
      type: Conditions.NONE
    }
  ];

  const [vmStateConfig, currencies] = Rain1155.generateScript([canMintConfig], priceConfig);

  initializeConfig = {
    vmStateBuilder: stateBuilder.address,
    vmStateConfig: vmStateConfig,
    currencies: currencies
  }

  encodedConfig = ethers.utils.defaultAbiCoder.encode(
    [
      "tuple(string name, string symbol, string baseURI, uint256 supplyLimit, address recipient, address owner)",
    ],
    [constructorConfig]
  );
});

it("Anyone should be able to create child (createChild)", async () => {

  const createChildTx = await rain721AFactory
    .connect(signer1)
    .createChild(encodedConfig);

  const { sender, child } = await getEventArgs(
    createChildTx,
    "NewChild",
    rain721AFactory
  );
  expect(sender).to.equals(signer1.address);

  await checkChildIntegrity(rain721AFactory, child, constructorConfig);
});


