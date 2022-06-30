import { artifacts, ethers } from "hardhat";
import { Rain721A, ConstructorConfigStruct, StateConfigStruct } from "../typechain/Rain721A";
import type { AllStandardOpsStateBuilder } from "../typechain/AllStandardOpsStateBuilder";
import type { ReserveToken } from "../typechain/ReserveToken";
import type { Rain721AFactory } from "../typechain/Rain721AFactory";
import { Rain1155, price, condition, Type, Conditions } from "rain-game-sdk";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { eighteenZeros, getEventArgs} from "./utils"
import { expect } from "chai";

export let rain721a1: Rain721A;
export let rain721a2: Rain721A;
export let SDK: Rain1155;
export let rain721AFactory: Rain721AFactory;
export let USDT: ReserveToken;
export let stateBuilder: AllStandardOpsStateBuilder;

export let factoryDeployer: SignerWithAddress,
  signer1: SignerWithAddress,
  signer2: SignerWithAddress,
  recipient_: SignerWithAddress,
  owner_: SignerWithAddress

describe("Rain721A Test", () => {
  before(async () => {
    const signers = await ethers.getSigners();
    factoryDeployer = signers[0];
    signer1 = signers[1];
    signer2 = signers[2];
    recipient_ = signers[3];
    owner_ = signers[4];

    const stateBuilderFactory = await ethers.getContractFactory(
      "AllStandardOpsStateBuilder"
    );
    stateBuilder = await stateBuilderFactory.deploy() as AllStandardOpsStateBuilder;
    await stateBuilder.deployed();

    const Rain721AFactory = await ethers.getContractFactory("Rain721AFactory");

    rain721AFactory = await Rain721AFactory.connect(factoryDeployer).deploy() as Rain721AFactory;

    await rain721AFactory.deployed();

    const stableCoins = await ethers.getContractFactory("ReserveToken");

    USDT = await stableCoins.deploy() as ReserveToken;
    await USDT.deployed();
  });

  it("Factory should be deployed correctly",async () => {
    expect(rain721AFactory.address).to.be.not.null;
  });

  it("Signer1 should be able create child.",async () => {

    const priceConfig1: price[] = [
      {
        currency: {
          type: Type.ERC20,
          address: USDT.address
        },
        amount: ethers.BigNumber.from("10" + eighteenZeros)
      }
    ];

    const canMintConfig1: condition[] = [
      {
        type: Conditions.NONE
      }
    ];

    const [vmStateConfig, currencies_] = Rain1155.generateScript([[]], []);

    const config1: ConstructorConfigStruct = {
      name: "RAIN1",
      symbol: "RN1",
      totalSupply: 1000,
      vmStateBuilder: stateBuilder.address,
      vmStateConfig: vmStateConfig,
      currencies: currencies_,
      recipient: recipient_.address,
      owner: owner_.address,
      defaultURI: "DEFAULT_URI"
    }
    const child1Tx = await rain721AFactory.connect(signer1).createChildTyped(config1);

    const [sender, child] = await getEventArgs(child1Tx, "NewChild", rain721AFactory);

    expect(sender).to.equals(rain721AFactory.address);
    expect(child).to.be.not.null;

    rain721a1 = await ethers.getContractAt((await artifacts.readArtifact("Rain721A")).abi, child) as Rain721A;

    const config_1 = await getEventArgs(child1Tx, "Construct", rain721a1);
    const {name, symbol, priceScript, canMintScript, currencies, recipient, owner} = config_1[0];
    expect(name).to.equals(config1.name);
    expect(symbol).to.equals(config1.symbol);
    expect(currencies).to.deep.equals(config1.currencies);
    expect(recipient).to.equals(config1.recipient);
    expect(owner).to.equals(config1.owner);

    expect(await rain721a1.name()).to.equals(config1.name);
    expect(await rain721a1.symbol()).to.equals(config1.symbol);
    
    for(let i=0;i<currencies.legth;i++)
      expect(await rain721a1.currencies(i)).to.equals(currencies[i]);

    const canMintScript_1: StateConfigStruct = {
      sources: canMintScript.sources,
      constants: canMintScript.constants,
    }

    const priceScript_1: StateConfigStruct = {
      sources: priceScript.sources,
      constants: priceScript.constants,
    }

    const priceConfig_1 = Rain1155.generatePriceConfig(priceScript_1, currencies);
    const canMintConfig_1 = Rain1155.generateCanMintConfig(canMintScript_1);

    expect(priceConfig_1).to.deep.equals(priceConfig1);
    expect(canMintConfig_1[0]).to.deep.equals(canMintConfig1);
  });

  it("Signer2 should be able create child.",async () => {

    const priceConfig2: price[] = [
      {
        currency: {
          type: Type.ERC20,
          address: USDT.address
        },
        amount: ethers.BigNumber.from("10" + eighteenZeros)
      }
    ];

    const canMintConfig2: condition[] = [
      {
        type: Conditions.ERC20BALANCE,
        address: USDT.address,
        balance: ethers.BigNumber.from("100" + eighteenZeros)
      }
    ];

    const [ vmStateConfig, currencies_] = Rain1155.generateScript([canMintConfig2], priceConfig2);


    const config2: ConstructorConfigStruct = {
      name: "RAIN2",
      symbol: "RN2",
      totalSupply: 2000,
      vmStateBuilder: stateBuilder.address,
      vmStateConfig: vmStateConfig,
      currencies: currencies_,
      recipient: recipient_.address,
      owner: owner_.address,
      defaultURI: "DEFAULT_URI"
    }
    const child2Tx = await rain721AFactory.connect(signer2).createChildTyped(config2);

    const [sender, child] = await getEventArgs(child2Tx, "NewChild", rain721AFactory);

    expect(sender).to.equals(rain721AFactory.address);
    expect(child).to.be.not.null;

    rain721a2 = await ethers.getContractAt((await artifacts.readArtifact("Rain721A")).abi, child) as Rain721A;

    const config_2 = await getEventArgs(child2Tx, "Construct", rain721a2);
    const {name, symbol, priceScript, canMintScript, currencies, recipient, owner} = config_2[0];
    expect(name).to.equals(config2.name);
    expect(symbol).to.equals(config2.symbol);
    expect(currencies).to.deep.equals(config2.currencies);
    expect(recipient).to.equals(config2.recipient);
    expect(owner).to.equals(config2.owner);

    expect(await rain721a2.name()).to.equals(config2.name);
    expect(await rain721a2.symbol()).to.equals(config2.symbol);
    
    for(let i=0;i<currencies.legth;i++)
      expect(await rain721a2.currencies(i)).to.equals(currencies[i]);

    const vmScript: StateConfigStruct = {
      sources: [canMintScript.sources, priceScript.sources],
      constants: canMintScript.constants,
    }
    // expect(canMintConfig_2[0]).to.deep.equals(canMintConfig2);
  });
});