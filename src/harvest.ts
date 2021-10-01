import {BigNumber, Contract, ContractReceipt, ethers, Signer} from "ethers";
import fetch from "node-fetch";
import {chainFilter} from "./filters";
import {Erc20s, Token} from "./token";
import {Chain} from "./chain";
import {Vault, Vaults} from "./vault";
import vaultAbi from './abis/vault.json'
import poolAbi from './abis/pool.json'
import {Pool, Pools} from "./pool";
import {
    InsufficientApprovalError,
    InsufficientBalanceError,
    InsufficientPoolBalanceError,
    InsufficientVaultBalanceError,
    InvalidAmountError
} from "./errors";

export class HarvestSDK {

    private readonly signerOrProvider: ethers.Signer | ethers.providers.Provider;
    private _vaults: Vaults | null = null;
    private _pools: Pools | null = null;

    constructor(signerOrProvider: ethers.Signer | ethers.providers.Provider) {
        this.signerOrProvider = signerOrProvider;
    }

    /**
     * Approve a vault to spend the underlying token (belonging to the depositor)
     * If the underlying is already approved, don't approve for additional spend
     * @param vault
     * @param amount
     * @param signer
     */
    async approve(vault: Vault, amount: BigNumber): Promise<ContractReceipt> {
        if (vault.tokens.length > 1) throw new Error("Currently we do not support ERC721 tokens (such as Uniswap v3).");
        const underlyingContract = vault.underlying();
        const depositorAddress = await (this.signerOrProvider as ethers.Signer).getAddress();
        if (await this.checkBalance(underlyingContract, depositorAddress, amount)) {
            const tx = await underlyingContract.approve(vault.address, amount);
            return tx.wait();
        } else throw new InsufficientBalanceError(`You do not own enough ${await underlyingContract.name()} tokens. You currently have ${await underlyingContract.balanceOf(depositorAddress)} and you wanted to deposit ${amount}`);
    }

    /**
     * Deposit an amount into a vault, requires you to own the amount
     * of the asset you're interested in depositing.
     * @param vault
     * @param amount
     * @param signer
     */
    async deposit(vault: Vault, amount: BigNumber) {
        if(await this.checkAtLeast(vault.underlying(), await (this.signerOrProvider as Signer).getAddress(), vault.address, amount)){
            await vault.deposit(amount);
        } else throw new InsufficientApprovalError("Insufficient amount approved");
    }

    /**
     * With draw amount from the vault
     * @param vault Vault
     * @param amount BigNumber
     * @param signer ethers.Signer
     */
    async withdraw(vault: Vault, amount: BigNumber): Promise<ContractReceipt> {
        const contract = new ethers.Contract(vault.address, vaultAbi, this.signerOrProvider);
        // check balance
        // fail if asking for more than the balance available
        if (!await this.checkBalance(contract, await (this.signerOrProvider as Signer).getAddress(), amount)) {
            throw new InvalidAmountError();
        }
        const tx = await contract.withdraw(amount);
        return await tx.wait();
    }

    /**
     * Produce a list of all the erc20s that the project encompasses.
     * @return Promise<Erc20s>
     */
    async erc20s(chainId?: Chain): Promise<Erc20s> {
        const theFilter = chainFilter(chainId || await (this.signerOrProvider as Signer).getChainId() as Chain);
        return await fetch("https://harvest.finance/data/tokens.json").then(_ => _.json()).then(_ => _.data).then((tokens: any) => {
            return new Erc20s(Object.keys(tokens)
                .filter((name) => theFilter(tokens[name]))
                .map((name) => {
                    return new Token(parseInt(tokens[name].chain), tokens[name].tokenAddress, tokens[name].decimals, tokens[name].symbol, name);
                }));
        });
    }

    /**
     * Return a vaults object which contains all the vaults that are described
     * by the harvest api tokens endpoint.
     * @return Promise<Vaults>
     */
    async vaults(chainId?: Chain): Promise<Vaults> {
        if (this._vaults) return this._vaults;
        else {
            const theFilter = chainFilter(chainId || await (this.signerOrProvider as Signer).getChainId() as Chain);
            return await fetch("https://harvest.finance/data/tokens.json").then(_ => _.json()).then(_ => _.data).then((tokens: any) => {
                this._vaults = new Vaults(Object.keys(tokens)
                    .filter((name) => theFilter(tokens[name]))
                    .filter((name) => tokens[name].vaultAddress)
                    .map((name) => {
                        const tokenAddresses = Array.isArray(tokens[name].tokenAddress) ? tokens[name].tokenAddress : [tokens[name].tokenAddress];
                        return new Vault(this.signerOrProvider, parseInt(tokens[name].chain), tokens[name].vaultAddress, tokens[name].decimals, tokenAddresses, name);
                    }));
                return this._vaults;
            });

        }
    }

    /**
     * Get the pools object, it contains a list of all the pools
     * that the harvest api exposes.
     * @return Promise<Pools>
     */
    async pools(chainId?: Chain): Promise<Pools> {
        if (this._pools) return this._pools;
        else {
            const theFilter = chainFilter(chainId || await (this.signerOrProvider as Signer).getChainId() as Chain);
            return await fetch("https://harvest.finance/data/pools.json").then(_ => _.json()).then(_ => _.data).then((pools: any) => {
                this._pools = new Pools(Object.keys(pools)
                    .filter((name) => theFilter(pools[name]))
                    .map((name) => {
                        return new Pool(this.signerOrProvider, parseInt(pools[name].chain), pools[name].contractAddress, pools[name].collateralAddress, pools[name].id, pools[name].rewardTokens);
                    })
                );
                return this._pools;
            });
        }
    }

    /**
     * Fetch all vaults where the address holds a positive balance
     * @param address string
     * @param signer
     * @return Promise<{ balance: BigNumber; vault: Vault }[]>
     */
    async myVaults(address: string, chainId?: Chain): Promise<{ balance: BigNumber; vault: Vault }[]> {
        const allVaults = await this.vaults(chainId);
        const vaultBalances = await Promise.all(allVaults.vaults.map(vault => {
            try {
                return vault.balanceOf(address).then(balance => ({vault, balance}));
            } catch (e) {
                return ({vault, balance: BigNumber.from(0)});
            }
        }));
        return vaultBalances.filter(_ => _.balance.gt(0));
    }

    /**
     * Allow the user to stake a fToken amount into the pool, the pool contains
     * the expected
     * @param pool
     * @param amountInGwei
     * @param signer
     */
    async stake(pool: Pool, amountInGwei: BigNumber) {
        // check that the user has the appropriate balance of collateral before allowing them to
        if (await this.checkBalance(new ethers.Contract(pool.collateralAddress, vaultAbi, this.signerOrProvider), await (this.signerOrProvider as Signer).getAddress(), amountInGwei)) {
            const poolContract = new ethers.Contract(pool.address, poolAbi, this.signerOrProvider);
            const tx = await poolContract.stake(amountInGwei);
            return await tx.wait();
        } else throw new InsufficientVaultBalanceError(`You don't hold enough balance in the vault ${pool.collateralAddress}`);
    }

    /**
     * Allow the user the ability to unstake an amount from the pool.
     * @param pool Pool
     * @param amountInGwei BigNumber
     * @param signer Signer
     */
    async unstake(pool: Pool, amountInGwei: BigNumber) {
        // check that the user has the appropriate balance of collateral before allowing them to
        const poolContract = new ethers.Contract(pool.address, poolAbi, this.signerOrProvider);
        if (await this.checkBalance(poolContract, await (this.signerOrProvider as Signer).getAddress(), amountInGwei)) {
            const tx = await poolContract.withdraw(amountInGwei);
            return await tx.wait();
        } else throw new InsufficientPoolBalanceError(`You don't hold enough balance in the pool ${pool.address}`);
    }

    /**
     * Perform the approve, deposit, approve, stake sequence of events that
     * are required to go from having an LP token (or single token) to having
     * a staked amount in the pool.
     * @param vault
     * @param amount
     * @param signer
     */
    async depositAndStake(vault: Vault, amount: BigNumber, chainId?: Chain) {
        // approve the underlying LP amounts
        if (vault.tokens.length > 1) throw new Error("We cannot handle ERC721 tokens (such as Uniswap V3) yet...");
        const depositorAddress = await (this.signerOrProvider as Signer).getAddress();
        await this.approve(vault, amount);
        await this.deposit(vault, amount);
        const balanceOfFToken = await vault.balanceOf(depositorAddress);
        const pool = await this.pools(chainId).then(_ => _.findByVault(vault));
        await vault.approve(pool.address, balanceOfFToken);
        this.stake(pool, balanceOfFToken);
    }

    /**
     * Do a balance check on the contract
     * @param contract
     * @param address
     * @param amount
     * @return Promise<boolean>
     */
    private async checkBalance(contract: ethers.Contract, address: string, amount: BigNumber): Promise<boolean> {
        const balance = await contract.balanceOf(address);
        return balance.gte(amount);
    }

    /**
     * Check the spender is authorised to spend the amount of the owner's funds.
     * @param contract
     * @param owner
     * @param spender
     * @param amount
     */
    private async checkAtLeast(contract: ethers.Contract, owner: string, spender: string, amount: BigNumber) {
        const allowance = await contract.allowance(owner, spender);
        return allowance.gte(amount);
    }
}
