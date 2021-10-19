/**
 * Represents an ERC20 token with a unique address and some metadata.
 */
import {Chain} from "./chain";
import {BigNumber, Contract, ContractReceipt, ethers} from "ethers";
import erc20Abi from './abis/erc20.json';

export class Token {
    /**
     * The contract address on the chain on which this token lives
     */
    private signerOrProvider: ethers.Signer | ethers.providers.Provider;
    readonly contract: Contract;
    readonly address: string;
    readonly chainId: Chain;
    readonly decimals: number;
    readonly symbol?: string;

    constructor(signerOrProvider: ethers.Signer|ethers.providers.Provider, chainId: Chain, address: string, decimals: number, symbol?: string) {
        this.signerOrProvider = signerOrProvider;
        this.contract = new ethers.Contract(address, erc20Abi, signerOrProvider);
        this.address = address;
        this.chainId = chainId;
        this.decimals = decimals;
        this.symbol = symbol;
    }

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

    constructor(tokens: Token[]){
        // todo this filters uniswap v3 due to the token having an array of addresses.
        this.tokens = tokens.filter(token => !Array.isArray(token.address));
        tokens.forEach(token => {
            if(token.symbol) this.bySymbol.set(token.symbol.toLowerCase(), token);
            if(!Array.isArray(token.address)) this.byAddress.set(token.address.toLowerCase(), token);
        })
    }

    findTokenByAddress(address: string) {
        return this.byAddress.get(address.toLowerCase())!;
    }

    findTokenBySymbol(symbol: string) {
        return this.bySymbol.get(symbol.toLowerCase())!;
    }

}
