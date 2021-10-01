/**
 * Represents a Pool contract with an address
 * Pools implement the erc20 interface, and thus all the usual methods
 * apply
 */
import {BigNumber, ContractReceipt, ethers} from "ethers";
import {Chain} from "./chain";
import poolAbi from './abis/pool.json';
import {Vault} from "./vault";

export class Pool {

    /**
     * The contract address on the chain on which this token lives
     */
    private signerOrProvider: ethers.Signer| ethers.providers.Provider;
    readonly address: string;
    readonly chainId: Chain;
    readonly collateralAddress: string;
    readonly name?: string;
    readonly rewards: string[];

    constructor(signerOrProvider: ethers.Signer| ethers.providers.Provider, chainId: Chain, address: string, collateralAddress: string, name: string, rewards: string[]) {
        this.signerOrProvider = signerOrProvider;
        this.address = address;
        this.chainId = chainId;
        this.collateralAddress = collateralAddress;
        this.name = name;
        this.rewards = rewards;
    }

    balanceOf(address: string): Promise<BigNumber> {
        const contr = new ethers.Contract(this.address, poolAbi, this.signerOrProvider);
        return contr.balanceOf(address);
    }

    async claimRewards(): Promise<ContractReceipt> {
        const contr = new ethers.Contract(this.address, poolAbi, this.signerOrProvider);
        const tx = await contr.getAllRewards();
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
        else throw new Error(`Could not find an associated pool using vault ${vault.name}`);
    }
}
