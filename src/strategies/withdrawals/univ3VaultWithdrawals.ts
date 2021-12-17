import {IWithdrawalStrategy} from "./IWithdrawalStrategy";
import {BigNumber, ContractReceipt, ethers} from "ethers";
import uniV3VaultAbi from "../../abis/univ3vault.json";

export interface Univ3VaultWithdrawalsArgs {
    address: string,
    signerOrProvider: ethers.Signer | ethers.providers.Provider
}

export class Univ3VaultWithdrawals implements IWithdrawalStrategy {
    private args: Univ3VaultWithdrawalsArgs;

    constructor(vaultStrategyArgs: Univ3VaultWithdrawalsArgs) {
        this.args = vaultStrategyArgs;
    }

    async withdraw(amount: BigNumber): Promise<ContractReceipt> {
        const contr = new ethers.Contract(this.args.address, uniV3VaultAbi, this.args.signerOrProvider);
        const sqrtPrice = await contr.getSqrtPriceX96();
        await contr.token0();
        await contr.token1();
        // @todo bound this slippage/tolerance parameter so a) we don't fail b) we don't expose ourselves to lots of slippage
        const tx = await contr['withdraw(uint256,bool,bool,uint256,uint256)'](amount, true, true, sqrtPrice, BigNumber.from(1));
        return await tx.wait();
    }

}
