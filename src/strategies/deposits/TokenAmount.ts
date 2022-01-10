import {IToken} from "../../tokens/token";
import {BigNumber} from "ethers";

export interface TokenAmount {
    token: IToken;
    amount: BigNumber;
}
