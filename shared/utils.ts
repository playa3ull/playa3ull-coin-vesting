import { BigNumber, ethers } from "ethers";

export const blockTimestamp = async () => {
    return (
        await ethers.provider.getBlock(await ethers.provider.getBlockNumber())
    ).timestamp;
};

export function toAtto(n: number): BigNumber {
    return ethers.utils.parseEther(n.toString());
}

export function fromAtto(n: BigNumber): number {
    return Number.parseFloat(ethers.utils.formatUnits(n, 18));
}

export function toBytes(s: string): Uint8Array {
    return ethers.utils.toUtf8Bytes(s);
}

export function getRatioPart(amount: BigNumber, value: BigNumber) {
    // Uses 2 decimal precision
    return amount.mul(value).div(10000);
}

export function timeNow() {
    return Math.round(new Date().valueOf() / 1000);
}

export function getRandomSeed() {
    return toAtto(Math.floor(Math.random() * 100000));
}

export function getInterfaceId(iface: ethers.utils.Interface) {
    let interfaceId = ethers.constants.Zero;
    const functions = Object.keys(iface.functions);

    for (const fn of functions) {
        interfaceId = interfaceId.xor(iface.getSighash(fn));
    }

    return interfaceId;
}

export function customError(errorName: string, ...args: any[]) {
    let argumentString = "";

    if (Array.isArray(args) && args.length) {
        // add quotation marks to first argument if it is of string type
        if (typeof args[0] === "string") {
            args[0] = `"${args[0]}"`;
        }

        // add joining comma and quotation marks to all subsequent arguments, if they are of string type
        argumentString = args.reduce(function (acc: string, cur: any) {
            if (typeof cur === "string") return `${acc}, "${cur}"`;
            else return `${acc}, ${cur.toString()}`;
        });
    }

    return `'${errorName}(${argumentString})'`;
}
