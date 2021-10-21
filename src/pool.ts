/**
 * Represents a Pool contract with an address
 * Pools implement the erc20 interface, and thus all the usual methods
 * apply
 */
import {BigNumber, Contract, ContractReceipt, ethers} from "ethers";
import {Chain} from "./chain";
import poolAbi from './abis/pool.json';
import {Vault} from "./vault";
import {Token} from "./token";

export class Pool {

    /**
     * The contract address on the chain on which this token lives
     */
    private signerOrProvider: ethers.Signer| ethers.providers.Provider;
    readonly contract: Contract;
    readonly address: string;
    readonly chainId: Chain;
    readonly collateralAddress: string;
    readonly name?: string;
    readonly rewards: string[];

    constructor(signerOrProvider: ethers.Signer| ethers.providers.Provider, chainId: Chain, address: string, collateralAddress: string, name: string, rewards: string[]) {
        this.signerOrProvider = signerOrProvider;
        this.contract = new ethers.Contract(address, poolAbi, this.signerOrProvider);
        this.address = address;
        this.chainId = chainId;
        this.collateralAddress = collateralAddress;
        this.name = name;
        this.rewards = rewards;
    }

    async balanceOf(address: string): Promise<BigNumber> {
        try {
            return await this.contract.balanceOf(address);
        } catch (e) {
            return BigNumber.from(0);
        }
    }

    async claimRewards(): Promise<Token> {
        const tx = await this.contract.getReward();
        await tx.wait();
        // figure out the rewards tokens
        const rewardAddress = this.contract.rewardToken();
        return new Token(this.signerOrProvider, this.chainId, rewardAddress, 18);
    }

    async withdraw(amountInWei: BigNumber) {
        const tx = await this.contract.withdraw(amountInWei);
        return await tx.wait();
    }

    async stake(amountInWei: BigNumber) {
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
