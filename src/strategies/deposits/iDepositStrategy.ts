import {BigNumber, ContractReceipt} from "ethers";
import {TokenAmount} from "./TokenAmount";

type BigNumberOrTokensAmounts = BigNumber|TokenAmount[]

export interface IDepositStrategy<T extends BigNumberOrTokensAmounts> {
    deposit(amount: T): Promise<ContractReceipt>
}
