import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers} from "hardhat";
import {
	ConstructorConfigStruct,
} from "../../typechain/Rain721A";
import {getEventArgs} from "../utils";
import {checkChildIntegrity} from "./childIntegrity";

import {expect} from "chai";
import {rain721aFactory} from "../1_setup";

export let factoryDeployer: SignerWithAddress,
	signer1: SignerWithAddress,
	signer2: SignerWithAddress,
	recipient_: SignerWithAddress,
	owner_: SignerWithAddress;

let constructorConfig: ConstructorConfigStruct;

let encodedConfig;

before(async () => {
	const signers = await ethers.getSigners();
	factoryDeployer = signers[0];
	signer1 = signers[1];
	signer2 = signers[2];
	recipient_ = signers[3];
	owner_ = signers[4];

	constructorConfig = {
		name: "rain721a",
		symbol: "RAIN721A",
		baseURI: "BASE_URI",
		supplyLimit: 1000,
		recipient: recipient_.address,
		owner: owner_.address,
	};

	encodedConfig = ethers.utils.defaultAbiCoder.encode(
		[
			"tuple(string name, string symbol, string baseURI, uint256 supplyLimit, address recipient, address owner)",
		],
		[constructorConfig]
	);
});

it("Anyone should be able to create child (createChild)", async () => {
	const createChildTx = await rain721aFactory
		.connect(signer1)
		.createChild(encodedConfig);

	const {sender, child} = await getEventArgs(
		createChildTx,
		"NewChild",
		rain721aFactory
	);
	expect(sender).to.equals(signer1.address);

	await checkChildIntegrity(rain721aFactory, child, constructorConfig);
});
