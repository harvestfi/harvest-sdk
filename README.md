# Harvest SDK

# Installation

    npm install --save harvest-sdk@0.0.1

# Usage

## Typical flow

    [list tokens] -> get token
    [use token] -> [deposit into vault] -> get vault (of which you now have a balance)
    [use vault] -> [stake in pool] -> get pool (of which you now have a balance)


## List all of my available tokens that I could deposit and stake

    // initialise the harvest SDK
    const wallet = new ethers.Wallet('<PRIVATE KEY HERE>');
    const harvest = new HarvestSDK({signerOrProvider: wallet});
    
    (await harvest.myTokens()).foreach(token => {
        console.log(token.name, await token.balanceOf(await wallet.getAddress()));    
    });

## Deposit and stake all of a token

    // initialise the harvest SDK
    const wallet = new ethers.Wallet('<PRIVATE KEY HERE>');
    const harvest = new HarvestSDK({signerOrProvider: wallet, chain: Chain});
    
    // find the crvtricrypto vault
    const crvTriCryptoVault = (await harvest.vaults()).findVaultByName("crvtricrypto"); // search is case insensitive
    
    // deposit and stake ALL your crvTricrypto LP (liquidity pool) tokens.
    await harvest.depositAndStake(crvTriCryptoVault, await crvTriCryptoVault.balanceOf(await wallet.getAddress()));


# Testing

You can run tests by using this command:

    npx hardhat test

It's worth stating that you MUST have the following lines at the top of mocha tests in order to force the loading of ethers to be overwritten by the hardhat environment
BEFORE ethers is loaded via the HarvestSDK class. Thus allowing testing.
Put this at the top of your tests cases:

    import * as dotenv from 'dotenv';
    const hre = require("hardhat");
    const ethers = hre.ethers;
    



# Intro

This project demonstrates an advanced Hardhat use case, integrating other tools commonly used alongside Hardhat in the ecosystem.

The project comes with a sample contract, a test for that contract, a sample script that deploys that contract, and an example of a task implementation, which simply lists the available accounts. It also comes with a variety of other tools, preconfigured to work with the project code.

Try running some of the following tasks:

```shell
npx hardhat accounts
npx hardhat compile
npx hardhat clean
npx hardhat test
npx hardhat node
npx hardhat help
REPORT_GAS=true npx hardhat test
npx hardhat coverage
npx hardhat run scripts/deploy.js
node scripts/deploy.js
npx eslint '**/*.js'
npx eslint '**/*.js' --fix
npx prettier '**/*.{json,sol,md}' --check
npx prettier '**/*.{json,sol,md}' --write
npx solhint 'contracts/**/*.sol'
npx solhint 'contracts/**/*.sol' --fix
```

# Etherscan verification

To try out Etherscan verification, you first need to deploy a contract to an Ethereum network that's supported by Etherscan, such as Ropsten.

In this project, copy the .env.template file to a file named .env, and then edit it to fill in the details. Enter your Etherscan API key, your Ropsten node URL (eg from Alchemy), and the private key of the account which will send the deployment transaction. With a valid .env file in place, first deploy your contract:

```shell
hardhat run --network ropsten scripts/deploy.js
```

Then, copy the deployment address and paste it in to replace `DEPLOYED_CONTRACT_ADDRESS` in this command:

```shell
npx hardhat verify --network ropsten DEPLOYED_CONTRACT_ADDRESS "Hello, Hardhat!"
```
