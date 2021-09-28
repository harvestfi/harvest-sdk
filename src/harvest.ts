import {BigNumber, ethers} from "ethers";
import fetch from "node-fetch";
import {chainFilter} from "./filters";
import {Erc20s, Token} from "./token";
import {Chain} from "./chain";
import {Vault, Vaults} from "./vault";
import vaultAbi from './abis/vault.json'

export class InvalidAmountError extends Error {}

export class HarvestSDK {

    private readonly network: ethers.providers.Networkish;

    constructor(network: ethers.providers.Networkish) {
        this.network = network;
    }

    approve(token: Token, amount: BigNumber, signer: ethers.Signer) {

    }

    deposit(vault: Vault, amount: BigNumber, signer: ethers.Signer) {

    }

    async withdraw(vault: Vault, amount: BigNumber, signer: ethers.Signer) {
        const contract = new ethers.Contract(vault.address, vaultAbi, signer);
        // check balance
        // cap at max balance (if supplied over the limit)
        if(!await this.checkBalance(contract, await signer.getAddress(), amount)){
            throw new InvalidAmountError();
        }
        const tx = await contract.withdraw(amount);
        return await tx.wait();
    }

    /**
     * Produce a list of all the erc20s that the project encompasses.
     * @return Promise<Erc20s>
     */
    erc20s(): Promise<Erc20s> {
        const theFilter = chainFilter(this.network as Chain);
        return fetch("https://harvest.finance/data/tokens.json").then(_ => _.json()).then(_ => _.data).then((tokens: any) => {
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
     */
    vaults(): Promise<Vaults> {
        const theFilter = chainFilter(this.network as Chain);
        return fetch("https://harvest.finance/data/tokens.json").then(_ => _.json()).then(_ => _.data).then((tokens: any) => {
            const vaults = Object.keys(tokens)
                .filter((name) => theFilter(tokens[name]))
                .filter((name) => tokens[name].vaultAddress)
                .map((name) => {
                    const tokenAddresses = Array.isArray(tokens[name].tokenAddress) ? tokens[name].tokenAddress : [tokens[name].tokenAddress];
                    return new Vault(parseInt(tokens[name].chain), tokens[name].vaultAddress, tokens[name].decimals, tokenAddresses, name);
                });
            return new Vaults(vaults);
        });
    }

    /**
     * Fetch all vaults where the address holds a positive balance
     * @param address
     */
    async myVaults(address: string): Promise<{ balance: BigNumber; vault: Vault }[]> {
        const allVaults = await this.vaults();
        const vaultBalances = await Promise.all(allVaults.vaults.map(vault => {
            return vault.balanceOf(address).then(balance => ({vault, balance}));
        }));
        return vaultBalances.filter(_ => _.balance.gt(0));
    }

    private async checkBalance(contract: ethers.Contract, address: string, amount: BigNumber): Promise<boolean> {
        const balance = await contract.balanceOf(address);
        return balance.gt(amount);
    }
}
