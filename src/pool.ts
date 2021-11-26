/**
 * Represents a Pool contract with an address
 * Pools implement the erc20 interface, and thus all the usual methods
 * apply
 */
import {BigNumber, Contract, ContractReceipt, ethers, Signer} from "ethers";
import {Chain} from "./chain";
import poolAbi from './abis/pool.json';
import erc20Abi from './abis/erc20.json';
import {Vault} from "./vault";
import {Token} from "./token";

interface EarnedAmount {
    token: Token,
    amount: BigNumber
}

interface PoolConstructorArgs {
    signerOrProvider: ethers.Signer | ethers.providers.Provider,
    chainId: Chain,
    address: string,
    collateralAddress: string,
    rewards: string[]
    name?: string,
}

export class Pool {

    /**
     * The contract address on the chain on which this token lives
     */
    private readonly signerOrProvider: ethers.Signer| ethers.providers.Provider;
    readonly contract: Contract;
    readonly address: string;
    readonly chainId: Chain;
    readonly collateralAddress: string;
    readonly name?: string;
    readonly rewards: string[];

    constructor(poolArgs: PoolConstructorArgs) {
        const {signerOrProvider, chainId, address, collateralAddress, name, rewards} = poolArgs;
        this.signerOrProvider = signerOrProvider;
        this.contract = new ethers.Contract(address, poolAbi, this.signerOrProvider);
        this.address = address;
        this.chainId = chainId;
        this.collateralAddress = collateralAddress;
        this.name = name;
        this.rewards = rewards;
    }

    /**
     * Retrieve the balance of the supplied address.
     * @param address
     */
    async balanceOf(address: string): Promise<BigNumber> {
        try {
            return await this.contract.balanceOf(address);
        } catch (e) {
            return BigNumber.from(0);
        }
    }

    /**
     * Claim rewards, most rewards are expected to be FARM or iFARM tokens.
     * @return Promise<Token>
     */
    async claimRewards(): Promise<Token> {
        const tx = await this.contract.getReward();
        await tx.wait();
        // figure out the rewards tokens
        const rewardAddress = await this.contract.rewardToken();
        const tokenContract = new Contract(rewardAddress, erc20Abi, this.signerOrProvider);
        return new Token({signerOrProvider: this.signerOrProvider, chainId: this.chainId, address: rewardAddress, decimals: await tokenContract.decimals()});
    }

    /**
     * Get the rewards token and amount of reward available to collect.
     * @param address
     * @return Promise<EarnedAmount>
     */
    async earned(address?: String): Promise<EarnedAmount> {
        address = address || await (this.signerOrProvider as Signer).getAddress();
        const rewardAddress = await this.contract.rewardToken();
        const tokenContract = new Contract(rewardAddress, erc20Abi, this.signerOrProvider);
        return {token: new Token({signerOrProvider: this.signerOrProvider, chainId: this.chainId, address: rewardAddress, decimals: await tokenContract.decimals(), symbol: await tokenContract.symbol()}), amount: await this.contract['earned(address)'](address)};
    }

    /**
     * Withdraw an amount (in wei) from the pool
     * @param amountInWei
     */
    async withdraw(amountInWei: BigNumber): Promise<ContractReceipt> {
        const tx = await this.contract.withdraw(amountInWei);
        return await tx.wait();
    }

    /**
     * Stake an amount (in wei) into the pool
     * This expectation here is that there is a Vault LP position
     * that has been approved to spend by the pool contract.
     * @param amountInWei
     */
    async stake(amountInWei: BigNumber): Promise<ContractReceipt> {
        const tx = await this.contract.stake(amountInWei);
        return await tx.wait();
    }
}

export class Pools {

    readonly pools: Pool[];

    constructor(pools: Pool[]) {
        this.pools = pools;
    }

    findByVault(vault: Vault): Pool {
        const pools = this.pools.filter(pool => {
            return pool.collateralAddress === vault.address;
        });
        if(pools.length) return pools[0];
        else throw new Error(`Could not find an associated pool using vault ${vault.symbol}`);
    }

    findByName(name: string): Pool {
        const pools = this.pools.filter(pool => {
            return pool.name === name;
        });
        if(pools.length) return pools[0];
        else throw new Error(`Could not find an associated pool using name ${name}`);
    }
}
