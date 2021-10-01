/**
 * Represents an ERC20 token with a unique address and some metadata.
 */
import {BigNumber, ContractReceipt, ethers, Signer} from "ethers";
import {Chain} from "./chain";
import vaultAbi from './abis/vault.json';
import erc20Abi from './abis/erc20.json';
import {Token} from "./token";
import {InvalidVaultAddressError, InvalidVaultNameError} from "./errors";

type Address = string;

export class Vault {
    /**
     * The contract address on the chain on which this token lives
     */
    private signerOrProvider: ethers.Signer | ethers.providers.Provider;
    private contract: ethers.Contract;
    readonly address: string;
    readonly chainId: Chain;
    readonly decimals: number;
    readonly tokens: string[];
    readonly name?: string;

    constructor(signerOrProvider: ethers.Signer|ethers.providers.Provider, chainId: Chain, address: string, decimals: number, tokens: string[], name?: string) {
        this.signerOrProvider = signerOrProvider;
        this.contract = new ethers.Contract(address, vaultAbi, signerOrProvider);
        this.address = address;
        this.chainId = chainId;
        this.decimals = decimals;
        this.tokens = tokens;
        this.name = name;
    }

    async balanceOf(address: Address): Promise<BigNumber> {
        return await this.contract.balanceOf(address);
    }

    async approve(spender: Address, amount: BigNumber): Promise<ContractReceipt> {
        const tx = await this.contract.approve(spender, amount);
        return await tx.wait();
    }

    async deposit(amount: BigNumber): Promise<ContractReceipt> {
        const tx = await this.contract.deposit(amount);
        return await tx.wait();
    }

    async getPricePerFullShare(): Promise<BigNumber> {
        return await this.contract.getPricePerFullShare();
    }

    underlying() {
        return new ethers.Contract(this.tokens[0], erc20Abi, this.signerOrProvider);
    }

}

export class Vaults {

    readonly vaults: Vault[];

    constructor(vaults: Vault[]) {
        this.vaults = vaults;
    }

    findByName(name: string): Vault {
        const vaults = this.vaults.filter(v => {
            return v.name?.toLowerCase() === name.toLowerCase();
        });
        if(vaults.length) return vaults[0];
        else throw new InvalidVaultNameError(`Could not find vault by ${name}`);

    }

    findByTokens(...tokens: Token[]): Vault[] {
        return this.vaults.filter(v => {
            const a = new Set(v.tokens.map(_ => _.toLowerCase()));
            return v.tokens.length === tokens.length && tokens.map(_ => _.address.toLowerCase()).filter(_ => a.has(_)).length === tokens.length;
        })
    }

    findByAddress(address: Address): Vault {
        const vaults = this.vaults.filter(v => {
            return v.address === address;
        });
        if(vaults.length) return vaults[0];
        else throw new InvalidVaultAddressError(`Could not find vault by ${address}`);
    }
}
