import {BigNumber, Contract, ContractReceipt, ethers} from "ethers";
import {Chain} from "../chain";
import erc20Abi from "../abis/erc20.json";

export interface TokenConstructor {
    signerOrProvider: ethers.Signer | ethers.providers.Provider,
    chainId: Chain,
    address: string,
    decimals: number,
    symbol?: string,
    abi?: object[]
}

export interface IToken {
    readonly contract: Contract;
    readonly address: string;
    readonly chainId: Chain;
    readonly decimals: number;
    readonly symbol?: string;
    readonly abi?: object[];
    balanceOf(address: String): Promise<BigNumber>
    allowance(address: string, spender: string): Promise<BigNumber>
    approve(address: string, amount: BigNumber): Promise<ContractReceipt>
}

export class Token implements IToken {
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
     * thus deciding it is 0 instead of failing.
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

    async allowance(address: string, spender: string): Promise<BigNumber> {
        return await this.contract.allowance(address, spender);
    }
}
