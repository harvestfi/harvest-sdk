import {IDepositStrategy} from "./iDepositStrategy";
import {BigNumber, ContractReceipt, ethers} from "ethers";
import vaultAbi from "../../abis/vault.json";
import {TokenAmount} from "./TokenAmount";
import {InvalidTokenAmountsError} from "../../errors";

export interface Univ2VaultDepositArgs {
    address: string,
    signerOrProvider: ethers.Signer | ethers.providers.Provider
}

export class Univ2VaultDeposits implements IDepositStrategy<BigNumber> {
    private args: Univ2VaultDepositArgs;

    constructor(vaultStrategyArgs: Univ2VaultDepositArgs) {
        this.args = vaultStrategyArgs;
    }

    async deposit(amount: BigNumber): Promise<ContractReceipt> {
        const contr = new ethers.Contract(this.args.address, vaultAbi, this.args.signerOrProvider);
        const tx = await contr.deposit(amount);
        return await tx.wait();
    }

}
