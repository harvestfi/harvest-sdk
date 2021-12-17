import {Chain} from "./chain";

export const chainFilter = (chain: Chain) => (token: any) => {
    return parseInt(token.chain) === chain;
};
export const missingAddressFilter = (token: any) => token.address;
