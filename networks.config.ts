require('dotenv').config();

module.exports = {
    hardhat: {
        // allowUnlimitedContractSize: true,
        forking: {
            url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_ETH_API_KEY}`,
            blockNumber: process.env.ETH_PINNED_BLOCK ? parseInt(process.env.ETH_PINNED_BLOCK) : 13433444
            // blockNumber: 13243414,
        }
    },
    // ropsten: {
    //   url: process.env.ROPSTEN_URL || "",
    //   accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    // },
};
