import {artifacts, ethers} from "hardhat";
import {
	Rain721A,
	ConstructorConfigStruct,
	StateConfigStruct,
	InitializeConfigStruct,
} from "../../typechain/Rain721A";
import {AllStandardOpsStateBuilder} from "../../typechain/AllStandardOpsStateBuilder";
import {ReserveToken} from "../../typechain/ReserveToken";
import {Rain721AFactory} from "../../typechain/Rain721AFactory";
import {Rain1155, price, condition, Conditions, Type} from "rain-game-sdk";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {concat, eighteenZeros, getEventArgs, op} from "../utils";
import {expect} from "chai";
import {StateConfig, VM} from "rain-sdk";

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
	owner_: SignerWithAddress;

describe("Rain721AFactory Test", () => {
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
		stateBuilder =
			(await stateBuilderFactory.deploy()) as AllStandardOpsStateBuilder;
		await stateBuilder.deployed();

		const Rain721AFactory = await ethers.getContractFactory("Rain721AFactory");

		rain721AFactory = (await Rain721AFactory.connect(
			factoryDeployer
		).deploy()) as Rain721AFactory;

		await rain721AFactory.deployed();

		const stableCoins = await ethers.getContractFactory("ReserveToken");

		USDT = (await stableCoins.deploy()) as ReserveToken;
		await USDT.deployed();
	});

	it("Factory should be deployed correctly", async () => {
		expect(rain721AFactory.address).to.be.not.null;
	});

	it("Signer1 should be able create child.", async () => {
		const priceConfig1: price[] = [
			{
				currency: {
					type: Type.ERC20,
					address: USDT.address,
				},
				amount: ethers.BigNumber.from("10" + eighteenZeros),
			},
		];

		const canMintConfig1: condition[] = [
			{
				type: Conditions.NONE,
			},
		];

		const [vmStateConfig_, currencies_] = Rain1155.generateScript(
			[canMintConfig1],
			priceConfig1
		);

		const constructorConfig1: ConstructorConfigStruct = {
			name: "RAIN1",
			symbol: "RN1",
			supplyLimit: 1000,
			recipient: recipient_.address,
			owner: owner_.address,
			baseURI: "BASE_URI",
		};

		const initialiseConfig1: InitializeConfigStruct = {
			vmStateBuilder: stateBuilder.address,
			vmStateConfig: vmStateConfig_,
			currency: USDT.address,
		};
		const child1Tx = await rain721AFactory
			.connect(signer1)
			.createChildTyped(constructorConfig1, initialiseConfig1);

		const [sender, child] = await getEventArgs(
			child1Tx,
			"NewChild",
			rain721AFactory
		);

		expect(sender).to.equals(rain721AFactory.address);
		expect(child).to.be.not.null;

		rain721a1 = (await ethers.getContractAt(
			(
				await artifacts.readArtifact("Rain721A")
			).abi,
			child
		)) as Rain721A;

		const constructorConfig_1 = await getEventArgs(
			child1Tx,
			"Construct",
			rain721a1
		);
		const {name, symbol, recipient, owner, baseURI, defaultURI, timeBound} =
			constructorConfig_1[0];
		expect(name).to.equals(constructorConfig1.name);
		expect(symbol).to.equals(constructorConfig1.symbol);
		expect(recipient).to.equals(constructorConfig1.recipient);
		expect(owner).to.equals(constructorConfig1.owner);
		expect(baseURI).to.equals(constructorConfig1.baseURI);

		expect(await rain721a1.name()).to.equals(constructorConfig1.name);
		expect(await rain721a1.symbol()).to.equals(constructorConfig1.symbol);

		const initialiseConfig_1 = await getEventArgs(
			child1Tx,
			"Initialize",
			rain721a1
		);
		const {vmStateConfig, vmStateBuilder, currencies} = initialiseConfig_1[0];

		const eventVmState: StateConfigStruct = {
			sources: vmStateConfig.sources,
			constants: vmStateConfig.constants,
		};

		expect(vmStateBuilder).to.equals(initialiseConfig1.vmStateBuilder);
	});

	it("Signer2 should be able create child.", async () => {
		const vmStateConfig_: StateConfig = {
			sources: [concat([op(VM.Opcodes.CONSTANT, 0)])],
			constants: [1],
		};

		const constructorConfig2: ConstructorConfigStruct = {
			name: "RAIN2",
			symbol: "RN2",
			baseURI: "BASE_URI",
			supplyLimit: 500,
			recipient: recipient_.address,
			owner: owner_.address,
		};

		const initialiseConfig2: InitializeConfigStruct = {
			vmStateBuilder: stateBuilder.address,
			vmStateConfig: vmStateConfig_,
			currency: USDT.address,
		};

		const child2Tx = await rain721AFactory
			.connect(signer2)
			.createChildTyped(constructorConfig2, initialiseConfig2);

		const [sender, child] = await getEventArgs(
			child2Tx,
			"NewChild",
			rain721AFactory
		);

		expect(sender).to.equals(rain721AFactory.address);
		expect(child).to.be.not.null;

		rain721a2 = (await ethers.getContractAt(
			(
				await artifacts.readArtifact("Rain721A")
			).abi,
			child
		)) as Rain721A;

		const constructorConfig_2 = await getEventArgs(
			child2Tx,
			"Construct",
			rain721a2
		);
		const {name, symbol, recipient, owner, baseURI, defaultURI, timeBound} =
			constructorConfig_2[0];
		expect(name).to.equals(constructorConfig2.name);
		expect(symbol).to.equals(constructorConfig2.symbol);
		expect(recipient).to.equals(constructorConfig2.recipient);
		expect(owner).to.equals(constructorConfig2.owner);
		expect(baseURI).to.equals(constructorConfig2.baseURI);

		expect(await rain721a2.name()).to.equals(constructorConfig2.name);
		expect(await rain721a2.symbol()).to.equals(constructorConfig2.symbol);

		const initialiseConfig_1 = await getEventArgs(
			child2Tx,
			"Initialize",
			rain721a2
		);
		const {vmStateConfig, vmStateBuilder, currencies} = initialiseConfig_1[0];

		expect(vmStateBuilder).to.equals(initialiseConfig2.vmStateBuilder);
	});
});
