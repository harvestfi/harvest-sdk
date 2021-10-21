import {BigNumber} from "ethers";

export class Erc721Error extends Error {
    constructor() {
        super("We cannot handle ERC721 tokens (such as Uniswap V3) yet...");
    }
}
export class InvalidAmountError extends Error {
    constructor(amount: BigNumber) {
        super(`Invalid amount specified ${amount}`);
    }
}
export class InvalidVaultNameError extends Error {}
export class InvalidPoolError extends Error {}
export class InvalidVaultAddressError extends Error {}
export class InsufficientVaultBalanceError extends Error {}
export class InsufficientPoolBalanceError extends Error {}
export class InsufficientBalanceError extends Error {}
export class InsufficientApprovalError extends Error {}
export class HarvestSDKArgsError extends Error {}
