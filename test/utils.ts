import { Logger } from "@ethersproject/logger";
import { version } from "./_version";
import { ContractTransaction, Contract, BigNumber, Overrides, ContractReceipt } from "ethers";
import { Result } from "ethers/lib/utils";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { AllStandardOps, ERC20, StateConfig, VM, } from "rain-sdk";
import { NewChildEvent } from "../typechain/Vapour721AFactory";
import { ethers, web3 } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Factory } from "../typechain";
const logger = new Logger(version);
const utils = ethers.utils

export const eighteenZeros = "000000000000000000";
export const BN = (num: number): BigNumber => {
  return ethers.BigNumber.from(num + eighteenZeros);
};
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export enum LocalOpcodes {
  SUPPLY_LIMIT = AllStandardOps.length,
  AMOUNT_WITHDRAWN,
  AMOUNT_PAYABLE,
  ACCOUNT,
  TARGET_UNITS,
  IERC721A_TOTAL_SUPPLY,
  IERC721A_TOTAL_MINTED,
  IERC721A_NUMBER_MINTED,
  IERC721A_NUMBER_BURNED,
}

export const Opcode = {
  ...AllStandardOps,
  ...LocalOpcodes,
};

export type Bytes = ArrayLike<number>;

export type BytesLike = Bytes | string;

export interface Hexable {
  toHexString(): string;
}

function isHexable(value: any): value is Hexable {
  return !!value.toHexString;
}

export function isHexString(value: any, length?: number): boolean {
  if (typeof value !== "string" || !value.match(/^0x[0-9A-Fa-f]*$/)) {
    return false;
  }
  if (length && value.length !== 2 + 2 * length) {
    return false;
  }
  return true;
}

export type DataOptions = {
  allowMissingPrefix?: boolean;
  hexPad?: "left" | "right" | null;
};

const HexCharacters: string = "0123456789abcdef";

function isInteger(value: number) {
  return typeof value === "number" && value == value && value % 1 === 0;
}

export function isBytes(value: any): value is Bytes {
  if (value == null) {
    return false;
  }

  if (value.constructor === Uint8Array) {
    return true;
  }
  if (typeof value === "string") {
    return false;
  }
  if (!isInteger(value.length) || value.length < 0) {
    return false;
  }

  for (let i = 0; i < value.length; i++) {
    const v = value[i];
    if (!isInteger(v) || v < 0 || v >= 256) {
      return false;
    }
  }
  return true;
}

export function hexlify(
  value: BytesLike | Hexable | number | bigint,
  options?: DataOptions
): string {
  if (!options) {
    options = {};
  }

  if (typeof value === "number") {
    logger.checkSafeUint53(value, "invalid hexlify value");

    let hex = "";
    while (value) {
      hex = HexCharacters[value & 0xf] + hex;
      value = Math.floor(value / 16);
    }

    if (hex.length) {
      if (hex.length % 2) {
        hex = "0" + hex;
      }
      return "0x" + hex;
    }

    return "0x00";
  }

  if (typeof value === "bigint") {
    value = value.toString(16);
    if (value.length % 2) {
      return "0x0" + value;
    }
    return "0x" + value;
  }

  if (
    options.allowMissingPrefix &&
    typeof value === "string" &&
    value.substring(0, 2) !== "0x"
  ) {
    value = "0x" + value;
  }

  if (isHexable(value)) {
    return value.toHexString();
  }

  if (isHexString(value)) {
    if ((<string>value).length % 2) {
      if (options.hexPad === "left") {
        value = "0x0" + (<string>value).substring(2);
      } else if (options.hexPad === "right") {
        value += "0";
      } else {
        logger.throwArgumentError("hex data is odd-length", "value", value);
      }
    }
    return (<string>value).toLowerCase();
  }

  if (isBytes(value)) {
    let result = "0x";
    for (let i = 0; i < value.length; i++) {
      let v = value[i];
      result += HexCharacters[(v & 0xf0) >> 4] + HexCharacters[v & 0x0f];
    }
    return result;
  }

  return logger.throwArgumentError("invalid hexlify value", "value", value);
}

function addSlice(array: Uint8Array): Uint8Array {
  if (array.slice) {
    return array;
  }

  array.slice = function () {
    const args = Array.prototype.slice.call(arguments);
    return addSlice(new Uint8Array(Array.prototype.slice.apply(array, args)));
  };

  return array;
}

export function arrayify(
  value: BytesLike | Hexable | number,
  options?: DataOptions
): Uint8Array {
  if (!options) {
    options = {};
  }

  if (typeof value === "number") {
    logger.checkSafeUint53(value, "invalid arrayify value");

    const result = [];
    while (value) {
      result.unshift(value & 0xff);
      value = parseInt(String(value / 256));
    }
    if (result.length === 0) {
      result.push(0);
    }

    return addSlice(new Uint8Array(result));
  }

  if (
    options.allowMissingPrefix &&
    typeof value === "string" &&
    value.substring(0, 2) !== "0x"
  ) {
    value = "0x" + value;
  }

  if (isHexable(value)) {
    value = value.toHexString();
  }

  if (isHexString(value)) {
    let hex = (<string>value).substring(2);
    if (hex.length % 2) {
      if (options.hexPad === "left") {
        hex = "0" + hex;
      } else if (options.hexPad === "right") {
        hex += "0";
      } else {
        logger.throwArgumentError("hex data is odd-length", "value", value);
      }
    }

    const result = [];
    for (let i = 0; i < hex.length; i += 2) {
      result.push(parseInt(hex.substring(i, i + 2), 16));
    }

    return addSlice(new Uint8Array(result));
  }

  if (isBytes(value)) {
    return addSlice(new Uint8Array(value));
  }
  return logger.throwArgumentError("invalid arrayify value", "value", value);
}

export function zeroPad(value: BytesLike, length: number): Uint8Array {
  value = arrayify(value);

  if (value.length > length) {
    logger.throwArgumentError("value out of range", "value", arguments[0]);
  }

  const result = new Uint8Array(length);
  result.set(value, length - value.length);
  return addSlice(result);
}

export function bytify(
  value: number | BytesLike | Hexable,
  bytesLength = 1
): BytesLike {
  return zeroPad(hexlify(value), bytesLength);
}

export function concat(items: ReadonlyArray<BytesLike>): Uint8Array {
  const objects = items.map((item) => arrayify(item));
  const length = objects.reduce((accum, item) => accum + item.length, 0);

  const result = new Uint8Array(length);

  objects.reduce((offset, object) => {
    result.set(object, offset);
    return offset + object.length;
  }, 0);

  return addSlice(result);
}

export function op(code: number, erand = 0): Uint8Array {
  return concat([bytify(code), bytify(erand)]);
}

export const getEventArgs = async (
  tx: ContractTransaction,
  eventName: string,
  contract: Contract,
  contractAddressOverride: string = null
): Promise<Result> => {
  const address = contractAddressOverride
    ? contractAddressOverride
    : contract.address;

  const eventObj = (await tx.wait()).events.find(
    (x) =>
      x.topics[0] == contract.filters[eventName]().topics[0] &&
      x.address == address
  );

  if (!eventObj) {
    throw new Error(`Could not find event ${eventName} at address ${address}`);
  }

  return contract.interface.decodeEventLog(eventName, eventObj.data);
};

export function BNtoInt(x: BigNumber): number {
  return parseInt(x._hex);
}

export const getChild = async (
  factory: Factory,
  transaction: ContractTransaction
): Promise<string> => {
  const { child } = (await getEventArgs(
    transaction,
    "NewChild",
    factory
  )) as NewChildEvent["args"];

  if (!ethers.utils.isAddress(child)) {
    throw new Error(`invalid address: ${child} (${child.length} chars)`);
  }

  return child;
};

export const fetchFile = (_path: string): string => {
  try {
    return fs.readFileSync(_path).toString();
  } catch (error) {
    console.log(error);
    return "";
  }
};

export const writeFile = (_path: string, file: any): void => {
  try {
    fs.writeFileSync(_path, file);
  } catch (error) {
    console.log(error);
  }
};

export const exec = (cmd: string): string | Buffer => {
  const srcDir = path.join(__dirname, "..");
  try {
    return execSync(cmd, { cwd: srcDir, stdio: "inherit" });
  } catch (e) {
    throw new Error(`Failed to run command \`${cmd}\``);
  }
};

export const getTokenID = (tokenURI: string): number => {
  return parseInt(tokenURI.split("/")[1]);
};

export function debug(): Uint8Array {
  return op(Opcode.DEBUG);
}

export async function getPrice(
  start_price: number,
  end_price: number,
  priceChange: number,
  start_time: number
): Promise<BigNumber> {
  const time = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
  const startTime = BigNumber.from(start_time);
  const startPrice = utils.parseUnits(start_price.toFixed(18).toString())
  const endPrice = utils.parseUnits(end_price.toFixed(18).toString())
  const PriceChange = utils.parseUnits(priceChange.toFixed(17).toString())

  let price_ = time.sub(startTime).mul(PriceChange).add(startPrice)

  if (price_.lt(endPrice)) return price_;
  return endPrice;
}


export async function getBalance(contract: string, signer: SignerWithAddress): Promise<BigNumber> {
  if (contract == ZERO_ADDRESS) {
    return await ethers.provider.getBalance(signer.address);
  }
  let token = new ERC20(contract, signer);
  return await token.balanceOf(signer.address);
}

export async function getGasUsed(trx: ContractTransaction): Promise<BigNumber> {
  const receipt = await trx.wait();
  return BigNumber.from(receipt.cumulativeGasUsed).mul(BigNumber.from(receipt.effectiveGasPrice));
}

export enum slot {
  _supplyLimit = 201,
  _amountWithdrawn,
  _amountPayable,
  _vmStatePointer,
  _currency,
  _recipient,
  _royaltyBPS,
  baseURI
}

export async function getPrivate_uint256(contractAddress: string, slotIndex: number): Promise<BigNumber> {
  const variable = await ethers.provider.getStorageAt(contractAddress, slotIndex);
  return ethers.BigNumber.from(variable);
}

export async function getPrivate_string(contractAddress: string, slotIndex: number): Promise<string> {
  const variable = await ethers.provider.getStorageAt(contractAddress, slotIndex);
  const hexLength = "0x" + variable.slice(64);
  const length = parseInt(hexLength, 16);
  return web3.utils.toAscii(variable.slice(0, length + 2));
}

export async function getPrivate_address(contractAddress: string, slotIndex: number): Promise<string> {
  const variable = await ethers.provider.getStorageAt(contractAddress, slotIndex);
  return ("0x" + variable.slice(26));
}