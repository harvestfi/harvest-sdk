/**
 * Represents an ERC20 token with a unique address and some metadata.
 */
import {Chain} from "./chain";
import {BigNumber, Contract, ContractReceipt, ethers} from "ethers";
import univ2Abi from './abis/univ2lp.json';
import erc20Abi from './abis/erc20.json';

export interface TokenConstructor {
    signerOrProvider: ethers.Signer | ethers.providers.Provider,
    chainId: Chain,
    address: string,
    decimals: number,
    symbol?: string,
    abi?: object[]
}

export interface IToken {
    balanceOf(address: String): Promise<BigNumber>
    approve(amount: BigNumber): Promise<ContractReceipt>
}

export class Token {
    /**
     * The contract address on the chain on which this token lives
     */
    protected signerOrProvider: ethers.Signer | ethers.providers.Provider;
    readonly contract: Contract;
    readonly address: string;
    readonly chainId: Chain;
    readonly decimals: number;
    readonly symbol?: string;
    readonly abi?: object[];

    constructor(tokenArgs: TokenConstructor) {
        const {signerOrProvider, chainId, address, decimals, symbol, abi} = tokenArgs;
        this.signerOrProvider = signerOrProvider;
        this.abi = abi || erc20Abi;
        this.contract = new ethers.Contract(address, this.abi, signerOrProvider);
        this.address = address;
        this.chainId = chainId;
        this.decimals = decimals;
        this.symbol = symbol;
    }

    /**
     * Return the balanceOf the contract, handling errors
     * where we cannot seem to find the balance of the contract
     * this deciding it is 0 instead of failing.
     * @param address
     */
    async balanceOf(address: string): Promise<BigNumber> {
        try {
            return await this.contract.balanceOf(address);
        } catch (e) {
            return BigNumber.from(0);
        }
    }

    async approve(address: string, amount: BigNumber): Promise<ContractReceipt> {
        const tx = await this.contract.approve(address, amount);
        return await tx.wait();
    }
}

/**
 * @todo sort out issues around uniswap v3 tokens
 */
export class Tokens {

    private bySymbol = new Map<string, Token>();
    private byAddress = new Map<string, Token>();
    readonly tokens: Token[];

    constructor(tokens: Token[]) {
        // todo this filters uniswap v3 due to the token having an array of addresses.
        this.tokens = tokens.filter(token => !Array.isArray(token.address));
        tokens.forEach(token => {
            if (token.symbol) this.bySymbol.set(token.symbol.toLowerCase(), token);
            if (!Array.isArray(token.address)) this.byAddress.set(token.address.toLowerCase(), token);
        })
    }

    findTokenByAddress(address: string) {
        return this.byAddress.get(address.toLowerCase())!;
    }

    findTokenBySymbol(symbol: string) {
        return this.bySymbol.get(symbol.toLowerCase())!;
    }

}

export abstract class LPToken extends Token {
    abstract totalSupply(): Promise<BigNumber>
    abstract tokens(): Promise<Token[]>
}

/**
 * Curve tokens are single assets
 * and have associated pool contracts that contains information
 * about the breakdown of tokens.
 */
export class CRVLPToken extends LPToken {
    constructor(tokenArgs: TokenConstructor) {
        super(tokenArgs);
    }
    totalSupply(): Promise<BigNumber> {
        return Promise.resolve(BigNumber.from(0));
    }
    tokens(): Promise<Token[]> {
        return Promise.reject("Not implemented");
    }
}

export class UniV2LPToken extends Token implements LPToken {
    constructor(tokenArgs: TokenConstructor) {
        super({...tokenArgs, abi: univ2Abi});
    }
    totalSupply(): Promise<BigNumber> {
        return Promise.resolve(BigNumber.from(0));
    }
    tokens(): Promise<Token[]> {
        return Promise.reject("Not implemented");
    }
}

/**
 * Sushi is a clone of uniswapv2 and thus basically has the same
 * ABI as univ2
 */
export class SushiLPToken extends Token implements LPToken {
    constructor(tokenArgs: TokenConstructor) {
        super({...tokenArgs, abi: univ2Abi});
    }
    totalSupply(): Promise<BigNumber> {
        return Promise.resolve(BigNumber.from(0));
    }
    tokens(): Promise<Token[]> {
        return Promise.reject("Not implemented");
    }
}
