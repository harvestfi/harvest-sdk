import {BigNumber, Contract, ContractReceipt, ethers, Signer} from "ethers";
import fetch from "node-fetch";
import {chainFilter} from "./filters";
import {IToken, Token} from "./tokens/token";
import {Tokens} from "./tokens";
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
import {Univ3VaultWithdrawals} from "./strategies/withdrawals/univ3VaultWithdrawals";
import {Univ2VaultWithdrawals} from "./strategies/withdrawals/univ2VaultWithdrawals";
import {TokenAmount} from "./strategies/deposits/TokenAmount";
import {Univ3VaultDeposits} from "./strategies/deposits/univ3VaultDeposits";
import {Univ2VaultDeposits} from "./strategies/deposits/univ2VaultDeposits";

interface HarvestSDKArgs {
    signerOrProvider?: ethers.Signer | ethers.providers.Provider;
    chainId?: Chain;
}

/**
 * Harvest SDK
 */
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
     * @param amount BigNumber|TokenAmount[]
     */
    async approve<T extends BigNumber|TokenAmount[]>(vault: Vault<T>, amount: T): Promise<ContractReceipt[]> {
        // if (vault.tokens.length > 1) throw new Error("Currently we do not support ERC721 tokens (such as Uniswap v3).");
        return await Promise.all(vault.underlyingTokens().map(async token => {
            const depositorAddress = await (this.signerOrProvider as ethers.Signer).getAddress();
            const depositAmount = this.determineAmount(amount, token);
            if (await this.checkBalance(token.contract, depositorAddress, depositAmount)) {
                return await token.approve(vault.address, depositAmount);
            } else throw new InsufficientBalanceError(`You do not own enough ${token.symbol} tokens. You currently have ${await token.balanceOf(depositorAddress)} and you wanted to deposit ${amount}`);
        }));
    }

    /**
     * Deposit an amount into a vault, requires you to own the amount
     * of the asset you're interested in depositing.
     * @param vault Vault
     * @param amount BigNumber|TokenAmount[]
     */
    async deposit<T extends BigNumber|TokenAmount[]>(vault: Vault<T>, amount: T) {
        await Promise.all(vault.underlyingTokens().map(async token => {
            const depositorAddress = await (this.signerOrProvider as ethers.Signer).getAddress();
            const depositAmount = this.determineAmount(amount, token);
            if (!(await this.checkBalance(token.contract, depositorAddress, depositAmount))) {
                throw new InvalidAmountError(depositAmount);
            }
            if (!(await this.checkAtLeast(token.contract, depositorAddress, vault.address, depositAmount))) {
                throw new InsufficientApprovalError("Insufficient amount approved");
            }
        }));
        return await vault.deposit(amount);
    }

    /**
     * Withdraw amount from the vault
     * @param vault Vault
     * @param amount BigNumber
     */
    async withdraw(vault: Vault<BigNumber|TokenAmount[]>, amount: BigNumber): Promise<IToken[]> {
        // check balance
        // fail if asking for more than the balance available
        if (!await this.checkBalance(vault.contract, await (this.signerOrProvider as Signer).getAddress(), amount)) {
            throw new InvalidAmountError(amount);
        }
        return await vault.withdraw(amount);
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
            const tokensMap = await this.tokens();
            const theFilter = chainFilter(await this.getChainId());
            return await fetch(this.harvestTokensEndpoint).then(_ => _.json()).then(_ => _.data).then((tokens: any) => {
                this._vaults = new Vaults(Object.keys(tokens)
                    .filter((symbol) => theFilter(tokens[symbol]))
                    .filter((symbol) => tokens[symbol].vaultAddress)
                    .map((symbol) => {
                        const tokenAddresses: string[] = Array.isArray(tokens[symbol].tokenAddress) ? tokens[symbol].tokenAddress : [tokens[symbol].tokenAddress];
                        const tokenObjects = tokenAddresses.map(tokenAddress => tokensMap.findTokenByAddress(tokenAddress));
                        const withdrawStrategy = Array.isArray(tokens[symbol].tokenAddress) ? new Univ3VaultWithdrawals({address: tokens[symbol].vaultAddress, signerOrProvider: this.signerOrProvider}) : new Univ2VaultWithdrawals({address: tokens[symbol].vaultAddress, signerOrProvider: this.signerOrProvider});
                        const depositStrategy = Array.isArray(tokens[symbol].tokenAddress) ? new Univ3VaultDeposits({address: tokens[symbol].vaultAddress, signerOrProvider: this.signerOrProvider}) : new Univ2VaultDeposits({address: tokens[symbol].vaultAddress, signerOrProvider: this.signerOrProvider});
                        return new Vault<BigNumber|TokenAmount[]>({signerOrProvider: this.signerOrProvider, chainId: parseInt(tokens[symbol].chain), address: tokens[symbol].vaultAddress, decimals: tokens[symbol].decimals, tokens: tokenObjects, symbol, withdrawStrategy, depositStrategy});
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
            return await fetch(this.harvestPoolsEndpoint).then(_ => _.json()).then(_ => _.data).then((pools: any[]) => {
                this._pools = new Pools(pools
                    .filter(theFilter)
                    .map((pool) => {
                        return new Pool({
                            signerOrProvider: this.signerOrProvider,
                            chainId: parseInt(pool.chain),
                            address: pool.contractAddress,
                            collateralAddress: pool.collateralAddress,
                            name: pool.id,
                            rewards: pool.rewardTokens
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
    async myTokens(address?: string): Promise<{ balance: BigNumber; token: IToken }[]> {
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
    async myVaults(address?: string): Promise<{ balance: BigNumber; vault: Vault<BigNumber|TokenAmount[]> }[]> {
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
    async unstake(pool: Pool, amountInWei: BigNumber): Promise<Vault<BigNumber|TokenAmount[]>> {
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
    async depositAndStake<T extends BigNumber|TokenAmount[]>(vault: Vault<T>, amount: T) {
        // approve the underlying LP amounts
        // if (vault.tokens.length > 1) throw new Erc721Error();
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
     * @return IToken[] the tokens that were returned to the users wallet
     */
    async unstakeAndWithdraw(pool: Pool, amount: BigNumber): Promise<IToken[]> {
        const vault = await this.vaults().then(_ => _.findByPool(pool));
        // if (vault.tokens.length > 1) throw new Erc721Error();
        await this.unstake(pool, amount);
        const rewardToken = await pool.claimRewards();
        const depositorAddress = await (this.signerOrProvider as Signer).getAddress();
        // we withdraw the entire balance of the vault.
        // @todo this might not be entirely right. the reason being it might pull back any current vault funds that were not part of the unstaked amount
        const currentBalanceOfVault = await vault.balanceOf(depositorAddress);
        const tokens = await this.withdraw(vault, currentBalanceOfVault);
        return [...tokens, rewardToken];
        // return vault.underlyingToken();
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

    /**
     * Typescript helper function to determine if the given argument
     * is  of a BigNumber or TokenAmount type.
     * @param amount
     */
    private isBigNumber(amount: BigNumber | TokenAmount[]): amount is BigNumber {
        return (amount as BigNumber)._isBigNumber === true;
    }

    /**
     * Given a variable type argument of BigNumber or TokenAmount[]
     * attempt to determine the correct amount given the current token
     * @param amount
     * @param token
     */
    private determineAmount(amount: BigNumber|TokenAmount[], token: IToken): BigNumber  {
        if(this.isBigNumber(amount)){
            return amount;
        } else {
            return amount.filter(_ => _.token.address === token.address).map(_ => _.amount)[0]||BigNumber.from(0);
        }
    }
}
