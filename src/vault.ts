/**
 * Represents an ERC20 token with a unique address and some metadata.
 */
import {BigNumber, ethers, Signer} from "ethers";
import {Chain} from "./enums";
import vaultAbi from './abis/vault.json';
import {Token} from "./token";

export class Vault {
    /**
     * The contract address on the chain on which this token lives
     */
    readonly address: string;
    readonly chainId: Chain;
    readonly decimals: number;
    readonly tokens: string[];
    readonly name?: string;

    constructor(chainId: Chain, address: string, decimals: number, tokens: string[], name?: string) {
        this.address = address;
        this.chainId = chainId;
        this.decimals = decimals;
        this.tokens = tokens;
        this.name = name;
    }

    balanceOf(address: string): Promise<BigNumber> {
        const contr = new ethers.Contract(this.address, vaultAbi, ethers.getDefaultProvider());
        return contr.balanceOf(address);
    }

    approve(amount: BigNumber) {
        const contr = new ethers.Contract(this.address, vaultAbi, ethers.getDefaultProvider());
        return contr.approve(amount);
    }

}

export class Vaults {

    private vaults: Vault[];

    constructor(vaults: Vault[]) {
        this.vaults = vaults;
    }

    findByName(name: string): Vault {
        const vaults = this.vaults.filter(v => {
            return v.name?.toLowerCase() === name.toLowerCase();
        });
        if(vaults) return vaults[0];
        else throw new Error(`Could not find vault by ${name}`);

    }

    findByTokens(...tokens: Token[]): Vault[] {
        return this.vaults.filter(v => {
            const a = new Set(v.tokens.map(_ => _.toLowerCase()));
            return v.tokens.length === tokens.length && tokens.map(_ => _.address.toLowerCase()).filter(_ => a.has(_)).length === tokens.length;
        })
    }

    findByAddress(address: string): Vault {
        const vaults = this.vaults.filter(v => {
            return v.address === address;
        });
        if(vaults) return vaults[0];
        else throw new Error(`Could not find vault by ${name}`);
    }
}
