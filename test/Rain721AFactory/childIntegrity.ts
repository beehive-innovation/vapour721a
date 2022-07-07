import { artifacts, ethers } from "hardhat";
import { expect } from "chai";
import { Rain721A } from "../../typechain/Rain721A";

export const checkChildIntegrity = async (rain721AFactory, child, constructorConfig) => {
  let rain721a = (await ethers.getContractAt(
    (
      await artifacts.readArtifact("Rain721A")
    ).abi,
    child
  )) as Rain721A;

  expect(await rain721AFactory.isChild(child)).to.be.true;
  expect(rain721a.address).to.equals(child);
  expect(await rain721a.owner()).to.equals(
    constructorConfig.owner,
    `Owner is ${rain721a.owner()} not ${constructorConfig.owner}`
  );
  expect(await rain721a.name()).to.equals(
    constructorConfig.name,
    `name is ${rain721a.name()} not ${constructorConfig.name}`
  );
  expect(await rain721a.symbol()).to.equals(
    constructorConfig.symbol,
    `symbol is ${rain721a.symbol()} not ${constructorConfig.symbol}`
  );
  expect(await rain721a.baseURI()).to.equals(
    constructorConfig.baseURI,
    `tokenURI is ${rain721a.tokenURI(2)} not ${constructorConfig.baseURI}`
  );
  expect(await rain721a.supplyLimit()).to.equals(
    constructorConfig.supplyLimit,
    `totalSupply is ${rain721a.totalSupply()} not ${constructorConfig.supplyLimit}`
  );
  expect(await rain721a.recipient()).to.equals(
    constructorConfig.recipient,
    `totalSupply is ${rain721a.recipient()} not ${constructorConfig.recipient}`
  );
};
