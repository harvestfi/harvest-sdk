import {Chain} from "./chain";
import {Network} from "@ethersproject/networks";
import {ethers} from "ethers";

export class Networks {

    static getNetwork(chainId?: Chain): Network {
        switch (chainId) {
            case Chain.BSC:
                return {
                    name: "bnb",
                    chainId,
                    _defaultProvider: () => new ethers.providers.JsonRpcProvider("https://bsc-dataseed.binance.org", chainId)
                };
            case Chain.POLYGON:
                return {
                    name: "polygon",
                    chainId,
                    _defaultProvider: () => new ethers.providers.JsonRpcProvider("https://polygon-rpc.com/", chainId)
                };
            default:
                return ethers.providers.getNetwork(chainId|| Chain.ETH); // default to ETH

        }

    }
}
