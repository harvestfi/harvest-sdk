import * as dotenv from 'dotenv';
import { task, HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import {HardhatNetworkConfig} from "hardhat/types";
import {NetworksUserConfig} from "hardhat/src/types/config";
// This adds support for typescript paths mappings
// import "tsconfig-paths/register";
// require("hardhat-gas-reporter");
// require("solidity-coverage");
const networks = require('./networks.config');

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
const config: HardhatUserConfig = {
  solidity: "0.8.4",
  defaultNetwork: "hardhat",
  networks,
  // gasReporter: {
  //   enabled: process.env.REPORT_GAS !== undefined,
  //   currency: "USD",
  // },
  // etherscan: {
  //   apiKey: process.env.ETHERSCAN_API_KEY,
  // },
  mocha: {
    timeout: 120000
  }
};
export default config;
