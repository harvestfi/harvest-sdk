import {BigNumber, Contract, ContractReceipt, ethers, Signer} from "ethers";
import fetch from "node-fetch";
import {chainFilter} from "./filters";
import {Token, Tokens} from "./token";
import {Chain} from "./chain";
import {Vault, Vaults} from "./vault";
import vaultAbi from './abis/vault.json'
import erc20Abi from './abis/erc20.json'
import {Pool, Pools} from "./pool";
import {
    Erc721Error,
    HarvestSDKArgsError,
    InsufficientApprovalError,
    InsufficientBalanceError,
    InsufficientPoolBalanceError,
    InsufficientVaultBalanceError,
    InvalidAmountError
} from "./errors";
import {Networks} from "./networks";

interface HarvestSDKArgs {
    signerOrProvider?: ethers.Signer | ethers.providers.Provider;
    chainId?: Chain;
}

export class HarvestSDK {

    private readonly signerOrProvider: ethers.Signer | ethers.providers.Provider;
    private readonly chainId?: Chain;
    private readonly harvestTokensEndpoint = "https://harvest.finance/data/tokens.json";
    private readonly harvestPoolsEndpoint = "https://harvest.finance/data/pools.json";
    private _vaults: Vaults | null = null;
    private _pools: Pools | null = null;
    private _tokens: Tokens | null = null;

    constructor(harvestArgs: HarvestSDKArgs) {
        const {chainId, signerOrProvider} = harvestArgs;
        if (!chainId && !signerOrProvider) throw new HarvestSDKArgsError("At least 1 of chainId or signerOrProvider is required. Ideally signerOrProvider");
        this.signerOrProvider = signerOrProvider || ethers.getDefaultProvider(Networks.getNetwork(chainId));
        this.chainId = chainId;
    }

    private async getChainId(): Promise<Chain> {
        return this.chainId ||
            await (this.signerOrProvider as Signer).getChainId() ||
            await (this.signerOrProvider as ethers.providers.Provider).getNetwork().then(_ => _.chainId);
    }

    /**
     * Approve a vault to spend the underlying token (belonging to the depositor)
     * If the underlying is already approved, don't approve for additional spend
     * @param vault
     * @param amount
     */
    async approve(vault: Vault, amount: BigNumber): Promise<ContractReceipt> {
        if (vault.tokens.length > 1) throw new Error("Currently we do not support ERC721 tokens (such as Uniswap v3).");
        const underlyingContract = vault.underlyingToken();
        const depositorAddress = await (this.signerOrProvider as ethers.Signer).getAddress();
        if (await this.checkBalance(underlyingContract.contract, depositorAddress, amount)) {
            return await underlyingContract.approve(vault.address, amount);
        } else throw new InsufficientBalanceError(`You do not own enough ${underlyingContract.symbol} tokens. You currently have ${await underlyingContract.balanceOf(depositorAddress)} and you wanted to deposit ${amount}`);
    }

    /**
     * Deposit an amount into a vault, requires you to own the amount
     * of the asset you're interested in depositing.
     * @param vault Vault
     * @param amount BigNumber
     */
    async deposit(vault: Vault, amount: BigNumber) {
        const address = await (this.signerOrProvider as Signer).getAddress();
        if (!(await this.checkBalance(vault.underlyingToken().contract, address, amount))) {
            throw new InvalidAmountError(amount);
        }
        if (!(await this.checkAtLeast(vault.underlyingToken().contract, address, vault.address, amount))) {
            throw new InsufficientApprovalError("Insufficient amount approved");
        }
        return await vault.deposit(amount);
    }

    /**
     * Withdraw amount from the vault
     * @param vault Vault
     * @param amount BigNumber
     */
    async withdraw(vault: Vault, amount: BigNumber): Promise<ContractReceipt> {
        const contract = new ethers.Contract(vault.address, vaultAbi, this.signerOrProvider);
        // check balance
        // fail if asking for more than the balance available
        if (!await this.checkBalance(contract, await (this.signerOrProvider as Signer).getAddress(), amount)) {
            throw new InvalidAmountError(amount);
        }
        const tx = await contract.withdraw(amount);
        return await tx.wait();
    }

    /**
     * Produce a list of all the erc20s that the project encompasses.
     * @return Promise<Tokens>
     */
    async tokens(): Promise<Tokens> {
        if (this._tokens) return this._tokens;
        else {
            const theFilter = chainFilter(await this.getChainId());
            return await fetch(this.harvestTokensEndpoint).then(_ => _.json()).then(_ => _.data).then((tokens: any) => {
                this._tokens = new Tokens(Object.keys(tokens)
                    .filter(symbol => !Array.isArray(tokens[symbol].tokenAddress))
                    .filter((symbol) => theFilter(tokens[symbol]))
                    .map((symbol) => {
                        return new Token({
                            signerOrProvider: this.signerOrProvider,
                            chainId: parseInt(tokens[symbol].chain),
                            address: tokens[symbol].tokenAddress,
                            decimals: tokens[symbol].decimals,
                            symbol
                        });
                    }));
                return this._tokens;
            });
        }
    }

    /**
     * Return a vaults object which contains all the vaults that are described
     * by the harvest api tokens endpoint within this chain.
     * @return Promise<Vaults>
     */
    async vaults(): Promise<Vaults> {
        if (this._vaults) return this._vaults;
        else {
            const theFilter = chainFilter(await this.getChainId());
            return await fetch(this.harvestTokensEndpoint).then(_ => _.json()).then(_ => _.data).then((tokens: any) => {
                this._vaults = new Vaults(Object.keys(tokens)
                    .filter((symbol) => theFilter(tokens[symbol]))
                    .filter((symbol) => tokens[symbol].vaultAddress)
                    .map((symbol) => {
                        const tokenAddresses = Array.isArray(tokens[symbol].tokenAddress) ? tokens[symbol].tokenAddress : [tokens[symbol].tokenAddress];
                        return new Vault(this.signerOrProvider, parseInt(tokens[symbol].chain), tokens[symbol].vaultAddress, tokens[symbol].decimals, tokenAddresses, symbol);
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
    async pools(): Promise<Pools> {
        if (this._pools) return this._pools;
        else {
            const theFilter = chainFilter(await this.getChainId());
            return await fetch(this.harvestPoolsEndpoint).then(_ => _.json()).then(_ => _.data).then((pools: any) => {
                this._pools = new Pools(Object.keys(pools)
                    .filter((name) => theFilter(pools[name]))
                    .map((name) => {
                        return new Pool({
                            signerOrProvider: this.signerOrProvider,
                            chainId: parseInt(pools[name].chain),
                            address: pools[name].contractAddress,
                            collateralAddress: pools[name].collateralAddress,
                            name: pools[name].id,
                            rewards: pools[name].rewardTokens
                        });
                    })
                );
                return this._pools;
            });
        }
    }

    /**
     * Fetch all tokens where the address holds a positive balance and are
     * potential candidates for depositing into pools
     * @param address string
     * @return Promise<{ balance: BigNumber; pool: Pool }[]>
     */
    async myTokens(address?: string): Promise<{ balance: BigNumber; token: Token }[]> {
        const theAddress = address || await (this.signerOrProvider as Signer).getAddress();
        const allTokens = await this.tokens();
        const tokenBalances = await Promise.all(allTokens.tokens.map(async token => {
            return await token.balanceOf(theAddress).then(balance => ({token: token, balance}));
        }));
        return tokenBalances.filter(_ => _.balance.gt(0));
    }

    /**
     * Fetch all vaults where the address holds a positive balance
     * @param address string
     * @return Promise<{ balance: BigNumber; vault: Vault }[]>
     */
    async myVaults(address?: string): Promise<{ balance: BigNumber; vault: Vault }[]> {
        const theAddress = address || await (this.signerOrProvider as Signer).getAddress();
        const allVaults = await this.vaults();
        const vaultBalances = await Promise.all(allVaults.vaults.map(vault => {
            return vault.balanceOf(theAddress).then(balance => ({vault, balance}));
        }));
        return vaultBalances.filter(_ => _.balance.gt(0));
    }

    /**
     * Fetch all vaults where the address holds a positive balance
     * @param address string
     * @return Promise<{ balance: BigNumber; pool: Pool }[]>
     */
    async myPools(address?: string): Promise<{ balance: BigNumber; pool: Pool }[]> {
        const theAddress = address || await (this.signerOrProvider as Signer).getAddress();
        const allPools = await this.pools();
        const poolBalances = await Promise.all(allPools.pools.map(pool => {
            return pool.balanceOf(theAddress).then(balance => ({pool: pool, balance}));
        }));
        return poolBalances.filter(_ => _.balance.gt(0));
    }

    /**
     * Allow the user to stake a fToken (vault) amount into the pool, the pool contains
     * the expected
     * @param pool
     * @param amountInWei
     * @param signer
     */
    async stake(pool: Pool, amountInWei: BigNumber) {
        // check that the user has the appropriate balance of collateral before allowing them to stake
        const vaults = await this.vaults();
        const vault = vaults.findByPool(pool);
        if (await this.checkBalance(vault.contract, await (this.signerOrProvider as Signer).getAddress(), amountInWei)) {
            return await pool.stake(amountInWei);
        } else throw new InsufficientVaultBalanceError(`You don't hold enough balance in the vault ${vault.symbol} [${vault.address}]`);
    }

    /**
     * Allow the user the ability to unstake an amount from the pool.
     * @param pool Pool
     * @param amountInWei BigNumber
     * @param signer Signer
     */
    async unstake(pool: Pool, amountInWei: BigNumber): Promise<Vault> {
        // check that the user has the appropriate balance of collateral before allowing them to unstake
        if (await this.checkBalance(pool.contract, await (this.signerOrProvider as Signer).getAddress(), amountInWei)) {
            await pool.withdraw(amountInWei);
            const vaults = await this.vaults();
            return vaults.findByPool(pool);
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
    async depositAndStake(vault: Vault, amount: BigNumber) {
        // approve the underlying LP amounts
        if (vault.tokens.length > 1) throw new Erc721Error();
        const depositorAddress = await (this.signerOrProvider as Signer).getAddress();
        await this.approve(vault, amount);
        await this.deposit(vault, amount);
        const balanceOfFToken = await vault.balanceOf(depositorAddress);
        const pool = await this.pools().then(_ => _.findByVault(vault));
        await vault.approve(pool.address, balanceOfFToken);
        await this.stake(pool, balanceOfFToken);
        return pool;
    }

    /**
     * The inverse of deposit and stake. Perform the unstake, withdraw sequence of
     * events that are required to reverse from a stake position -> vault position -> underlying token
     * @param pool Pool
     * @param amount BigNumber
     */
    async unstakeAndWithdraw(pool: Pool, amount: BigNumber): Promise<Token> {
        const vault = await this.vaults().then(_ => _.findByPool(pool));
        if (vault.tokens.length > 1) throw new Erc721Error();
        await this.unstake(pool, amount);
        await pool.claimRewards();
        const depositorAddress = await (this.signerOrProvider as Signer).getAddress();
        // we withdraw the entire balance of the vault. @todo this might not be entirely right.
        const currentBalanceOfVault = await vault.balanceOf(depositorAddress);
        await this.withdraw(vault, currentBalanceOfVault);
        return vault.underlyingToken();
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
        return balance.gte(amount) && amount.gt(0);
    }

    /**
     * Check the spender is authorised to spend the amount of the owner's funds.
     * @param contract
     * @param owner
     * @param spender
     * @param amount
     */
    private async checkAtLeast(contract: ethers.Contract, owner: string, spender: string, amount: BigNumber): Promise<boolean> {
        const allowance = await contract.allowance(owner, spender);
        return allowance.gte(amount) && amount.gt(0);
    }



}
