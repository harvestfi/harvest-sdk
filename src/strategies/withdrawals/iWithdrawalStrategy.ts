import {BigNumber, ContractReceipt} from "ethers";
import {IToken} from "../../tokens/token";

export interface IWithdrawalStrategy {
    withdraw(amount: BigNumber): Promise<ContractReceipt>
}
