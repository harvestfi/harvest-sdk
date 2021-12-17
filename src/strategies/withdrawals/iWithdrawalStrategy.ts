import {BigNumber, ContractReceipt} from "ethers";

export interface IWithdrawalStrategy {
    withdraw(amount: BigNumber): Promise<ContractReceipt>
}
