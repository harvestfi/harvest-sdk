/**
 * Represents an ERC20 token with a unique address and some metadata.
 */
import {IToken} from "./tokens/token";

/**
 * @todo sort out issues around uniswap v3 tokens
 */
export class Tokens {

    private bySymbol = new Map<string, IToken>();
    private byAddress = new Map<string, IToken>();
    readonly tokens: IToken[];

    constructor(tokens: IToken[]) {
        // todo this filters uniswap v3 due to the token having an array of addresses.
        this.tokens = tokens.filter(token => !Array.isArray(token.address));
        tokens.forEach(token => {
            if (token.symbol) this.bySymbol.set(token.symbol.toLowerCase(), token);
            if (!Array.isArray(token.address)) this.byAddress.set(token.address.toLowerCase(), token);
        })
    }

    findTokenByAddress(address: string) {
        return this.byAddress.get(address.toLowerCase())!;
    }

    findTokenBySymbol(symbol: string) {
        return this.bySymbol.get(symbol.toLowerCase())!;
    }

}
