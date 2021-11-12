require('dotenv').config();

module.exports = {
    hardhat: {
        // allowUnlimitedContractSize: true,
        forking: {
            url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_ETH_API_KEY}`,
            // url: `https://mainnet.infura.io/v3/${process.env.INFURA_ETH_API_KEY}`,
            blockNumber: process.env.ETH_PINNED_BLOCK ? parseInt(process.env.ETH_PINNED_BLOCK) : 13536829
        }
    },
    // ropsten: {
    //   url: process.env.ROPSTEN_URL || "",
    //   accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    // },
};
