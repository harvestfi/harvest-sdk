import {IWithdrawalStrategy} from "./IWithdrawalStrategy";
import {IToken} from "../../tokens/token";
import {BigNumber, ethers, Signer} from "ethers";
import vaultAbi from "../../abis/vault.json";

export interface Univ2VaultWithdrawalsArgs {
    address: string,
    signerOrProvider: ethers.Signer | ethers.providers.Provider
}

export class Univ2VaultWithdrawals implements IWithdrawalStrategy {
    private args: Univ2VaultWithdrawalsArgs;

    constructor(vaultStrategyArgs: Univ2VaultWithdrawalsArgs) {
        this.args = vaultStrategyArgs;
    }

    async withdraw(amount: BigNumber): Promise<any> {
        const contr = new ethers.Contract(this.args.address, vaultAbi, this.args.signerOrProvider);
        const tx = await contr.withdraw(amount);
        return await tx.wait();
    }

}
