import {BigNumber, ethers} from "ethers";
import fetch from "node-fetch";
import {chainFilter} from "./filters";
import {Erc20s, Token} from "./token";
import {Chain} from "./enums";
import {Vault, Vaults} from "./vault";
import vaultAbi from './abis/vault.json'

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
        const tx = await contract.withdraw(amount);
        await tx.wait();
    }

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

    //
    // private async checkBalance(contract: ethers.Contract, amount: BigNumber): Promise<boolean> {
    //     const balance = await contract.balanceOf(await this.jsonRpcProvider.getAddress());
    //     console.log(balance);
    //     // const decimals = await contract.decimals();
    //     // const amountInWei = utils.parseUnits(amount, decimals);
    //     console.log(`Amount of requested withdraw ${amount}`);
    //     console.log(`Balance of account ${balance}`);
    //     return balance.toBigInt() > amount.toBigInt();
    //     // 200000000000000000
    //     // 29116707575365064
    // }
}
