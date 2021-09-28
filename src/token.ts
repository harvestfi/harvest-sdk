/**
 * Represents an ERC20 token with a unique address and some metadata.
 */
import {Chain} from "./chain";
import {BigNumber, ethers} from "ethers";
import vaultAbi from "./abis/vault.json";

export class Token {
    /**
     * The contract address on the chain on which this token lives
     */
    readonly address: string;
    readonly chainId: Chain;
    readonly decimals: number;
    readonly symbol?: string;
    readonly name?: string;

    constructor(chainId: Chain, address: string, decimals: number, symbol?: string, name?: string) {
        this.address = address;
        this.chainId = chainId;
        this.decimals = decimals;
        this.symbol = symbol;
        this.name = name;
    }

    balanceOf(address: string): BigNumber {
        const contr = new ethers.Contract(this.address, vaultAbi, ethers.getDefaultProvider());
        return contr.balanceOf(address);
    }

}

export class Erc20s {

    private byNames = new Map<string, Token>();
    private byAddress = new Map<string, Token>();

    constructor(tokens: Token[]){
        tokens.forEach(token => {
            if(token.name) this.byNames.set(token.name.toLowerCase(), token);
            if(!Array.isArray(token.address)) this.byAddress.set(token.address.toLowerCase(), token);
        })
    }

    findTokenByAddress(address: string) {
        return this.byAddress.get(address.toLowerCase())!;
    }

    findTokenByName(name: string) {
        return this.byNames.get(name.toLowerCase())!;
    }

}
