import {IDepositStrategy} from "./iDepositStrategy";
import {BigNumber, ContractReceipt, ethers} from "ethers";
import uniV3VaultAbi from "../../abis/univ3vault.json";
import {TokenAmount} from "./TokenAmount";
import {InvalidTokenAmountsError} from "../../errors";

export interface Univ3VaultDepositArgs {
    address: string,
    signerOrProvider: ethers.Signer | ethers.providers.Provider
}

export class Univ3VaultDeposits implements IDepositStrategy<TokenAmount[]> {
    private args: Univ3VaultDepositArgs;

    constructor(vaultStrategyArgs: Univ3VaultDepositArgs) {
        this.args = vaultStrategyArgs;
    }

    async deposit(amounts: TokenAmount[]): Promise<ContractReceipt> {
        const contr = new ethers.Contract(this.args.address, uniV3VaultAbi, this.args.signerOrProvider);
        const sqrtPrice = await contr.getSqrtPriceX96();
        const token0Address = (await contr.token0()).toLowerCase();
        const token1Address = (await contr.token1()).toLowerCase();
        const m = new Map(amounts.map(({token,amount})=> [token.address.toLowerCase(),amount]));
        if(!(m.has(token0Address) && m.has(token1Address))){
            throw new InvalidTokenAmountsError();
        }
        const tx = await contr['deposit(uint256,uint256,bool,bool,uint256,uint256)'](m.get(token0Address), m.get(token1Address), false, false, sqrtPrice, BigNumber.from(10));
        return await tx.wait();
    }

}
