import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import hre, { ethers } from "hardhat";
import { Vapour721AIntegrity } from "../typechain/Vapour721AIntegrity";
import {
  InitializeConfigStruct,
  InitializeEvent,
  Vapour721A,
} from "../typechain/Vapour721A";
import {
  Vapour721AFactory,
  ImplementationEvent,
} from "../typechain/Vapour721AFactory";
import { assert, expect } from "chai";
import {
  getEventArgs,
  memoryOperand,
  MemoryType,
  op,
  vapour721AOpcodes,
} from "./utils";
import { Token } from "../typechain/Token";
import { concat } from "ethers/lib/utils";

export let currency: Token;
export let vapour721AFactory: Vapour721AFactory;
export let vapour721AIntegrity: Vapour721AIntegrity;
export let vapour721A: Vapour721A;
export let recipient: SignerWithAddress,
  owner: SignerWithAddress,
  buyer0: SignerWithAddress,
  buyer1: SignerWithAddress,
  buyer2: SignerWithAddress,
  buyer3: SignerWithAddress,
  buyer4: SignerWithAddress,
  buyer5: SignerWithAddress,
  buyer6: SignerWithAddress,
  buyer7: SignerWithAddress;

before(async () => {
  console.log("Setting up environment for Vapour721A test");

  const signers = await ethers.getSigners();
  recipient = signers[0];
  owner = signers[1];
  buyer0 = signers[2];
  buyer1 = signers[3];
  buyer2 = signers[4];
  buyer3 = signers[5];
  buyer4 = signers[6];
  buyer5 = signers[7];
  buyer6 = signers[8];
  buyer7 = signers[9];

  const erc20Factory = await ethers.getContractFactory("Token");
  currency = (await erc20Factory.deploy("Vapour Token", "TKN")) as Token;
  await currency.deployed();

  const Vapour721AIntegrity = await ethers.getContractFactory(
    "Vapour721AIntegrity"
  );
  vapour721AIntegrity =
    (await Vapour721AIntegrity.deploy()) as Vapour721AIntegrity;
  await vapour721AIntegrity.deployed();

  const Vapour721AFactory = await ethers.getContractFactory(
    "Vapour721AFactory"
  );
  vapour721AFactory = (await Vapour721AFactory.deploy(
    vapour721AIntegrity.address
  )) as Vapour721AFactory;
  await vapour721AFactory.deployed();

  const [sender, implementation] = (await getEventArgs(
    vapour721AFactory.deployTransaction,
    "Implementation",
    vapour721AFactory
  )) as ImplementationEvent["args"];

  expect(sender).to.not.null;
  expect(implementation).to.not.null;
});

describe.only("Vapour721A Initialize test", () => {
  let vapour721AInitializeConfig: InitializeConfigStruct;
  it("Should deploy Vapour721A contract and initialize", async () => {
    vapour721AInitializeConfig = {
      name: "nft",
      symbol: "NFT",
      baseURI: "BASE_URI",
      supplyLimit: 36,
      recipient: recipient.address,
      owner: owner.address,
      royaltyBPS: 1000,
      admin: buyer0.address,
      vmStateConfig: {
        sources: [
          concat([
            op(vapour721AOpcodes.STATE, memoryOperand(MemoryType.Constant, 0)),
            op(vapour721AOpcodes.STATE, memoryOperand(MemoryType.Constant, 1)),
          ]),
        ],
        constants: [1, 0],
      },
      currency: currency.address,
    };

    const trx = await vapour721AFactory.createChildTyped(
      vapour721AInitializeConfig
    );

    const [sender, child] = await getEventArgs(
      trx,
      "NewChild",
      vapour721AFactory
    );
	console.log(sender, child)
    vapour721A = (await ethers.getContractAt(
      "Vapour721A",
      child
    )) as Vapour721A;

    const [config_, vmStateBuilder_] = (await getEventArgs(
      trx,
      "Initialize",
      vapour721A
    )) as InitializeEvent["args"];

    expect(config_.currency).to.equals(currency.address);
  });

  it("Should be able to initialize after creating with createChild method", async () => {
    const encodedConfig = ethers.utils.defaultAbiCoder.encode(
      [
        "tuple(string name, string symbol, string baseURI, uint256 supplyLimit, address recipient, address owner, address admin, uint256 royaltyBPS, address currency, tuple(bytes[] sources, uint256[] constants) vmStateConfig)",
      ],
      [vapour721AInitializeConfig]
    );
    const createTrx = await vapour721AFactory.createChild(encodedConfig);

    const [sender, child] = await getEventArgs(
      createTrx,
      "NewChild",
      vapour721AFactory
    );

    vapour721A = (await ethers.getContractAt(
      "Vapour721A",
      child
    )) as Vapour721A;

    const [config_, vmStateBuilder_] = (await getEventArgs(
      createTrx,
      "Initialize",
      vapour721A
    )) as InitializeEvent["args"];

    expect(config_.currency).to.deep.equals(
      vapour721AInitializeConfig.currency
    );
  });
});
