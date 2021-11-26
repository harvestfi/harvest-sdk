/**
 * Represents an ERC20 token with a unique address and some metadata.
 */
import {BigNumber, ContractReceipt, ethers} from "ethers";
import {Chain} from "./chain";
import vaultAbi from './abis/vault.json';
import {LPToken, Token, UniV2LPToken} from "./token";
import {InvalidPoolError, InvalidVaultAddressError, InvalidVaultNameError} from "./errors";
import {Pool} from "./pool";

type Address = string;

interface VaultConstructorArgs {
    signerOrProvider: ethers.Signer | ethers.providers.Provider,
    chainId: Chain,
    address: string,
    decimals: number,
    tokens: string[]
    symbol: string,
}

export class Vault {
    /**
     * The contract address on the chain on which this token lives
     */
    private signerOrProvider: ethers.Signer | ethers.providers.Provider;
    readonly contract: ethers.Contract;
    readonly address: string;
    readonly chainId: Chain;
    readonly decimals: number;
    readonly tokens: string[];
    readonly symbol: string;

    constructor(vaultArgs: VaultConstructorArgs) {
        const {signerOrProvider, chainId, address, decimals, symbol, tokens} = vaultArgs;
        this.signerOrProvider = signerOrProvider;
        this.contract = new ethers.Contract(address, vaultAbi, this.signerOrProvider);
        this.address = address;
        this.chainId = chainId;
        this.decimals = decimals;
        this.tokens = tokens;
        this.symbol = symbol;
    }

    async balanceOf(address: Address): Promise<BigNumber> {
        try {
            return await this.contract.balanceOf(address);
        } catch (e) {
            return BigNumber.from(0);
        }
    }

    async approve(spender: Address, amount: BigNumber): Promise<ContractReceipt> {
        const tx = await this.contract.approve(spender, amount);
        return await tx.wait();
    }

    async deposit(amount: BigNumber): Promise<ContractReceipt> {
        const tx = await this.contract.deposit(amount);
        return await tx.wait();
    }

    /**
     * Get the full price per full share.
     * If you combine this with the balanceOf, i.e. pricePerFullShare*balance
     * you will get the resultant amount of token to be returned in the
     * event of a withdrawal.
     */
    async getPricePerFullShare(): Promise<BigNumber> {
        return await this.contract.getPricePerFullShare();
    }

    /**
     * This only serves up the first token, in the case of erc721 uniswapv3 this will be wrong.
     * @todo resolve issues around uniswapv3, needs the correct ABI dependent on underlying
     */
    underlyingToken(): LPToken {
        return new UniV2LPToken({signerOrProvider: this.signerOrProvider, chainId: this.chainId, address: this.tokens[0], decimals: this.decimals, symbol: this.symbol});
    }

}

export class Vaults {

    readonly vaults: Vault[];

    constructor(vaults: Vault[]) {
        this.vaults = vaults;
    }

    findByName(name: string): Vault {
        const vaults = this.vaults.filter(v => {
            return v.symbol?.toLowerCase() === name.toLowerCase();
        });
        if(vaults.length) return vaults[0];
        else throw new InvalidVaultNameError(`Could not find vault by ${name}`);

    }

    findByTokens(...tokens: Token[]): Vault {
        const vaults = this.vaults.filter(v => {
            const a = new Set(v.tokens.map(_ => _.toLowerCase()));
            return v.tokens.length === tokens.length && tokens.map(_ => _.address.toLowerCase()).filter(_ => a.has(_)).length === tokens.length;
        });
        if(vaults.length) return vaults[0];
        else throw new InvalidVaultAddressError(`Could not find vault by tokens ${tokens.map(_=>_.symbol).join(",")}`);
    }

    findByAddress(address: Address): Vault {
        const vaults = this.vaults.filter(v => {
            return v.address === address;
        });
        if(vaults.length) return vaults[0];
        else throw new InvalidVaultAddressError(`Could not find vault by ${address}`);
    }

    findByPool(pool: Pool): Vault {
        const vaults = this.vaults.filter(vault => {
            return pool.collateralAddress === vault.address;
        });
        if(vaults.length) return vaults[0];
        else throw new InvalidPoolError(`Could not find vault by pool ${pool.name}[${pool.address}]`);
    }
}
