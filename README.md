# Harvest SDK

# Installation

    npm install --save @harvestfi/harvest-sdk@0.0.1

# Usage

## List all of my available tokens that I could deposit

    // initialise the harvest SDK
    const {HarvestSDK} = require("@harvestfi/harvest-sdk/harvest");
    const wallet = new ethers.Wallet('<PRIVATE KEY HERE>');
    const harvest = new HarvestSDK({signerOrProvider: wallet});
    const tokens = await harvest.myTokens();
    tokens.forEach(({balance, token}) => {
        console.log(`${token.symbol}: ${balance}`);
    });

## List all of my vaults i've deposited into

    // initialise the harvest SDK
    const {HarvestSDK} = require("@harvestfi/harvest-sdk/harvest");
    const wallet = new ethers.Wallet('<PRIVATE KEY HERE>');
    const harvest = new HarvestSDK({signerOrProvider: wallet});
    const vaults = await harvest.myVaults();
    vaults.forEach(({vault, balance}) => {
        console.log(`${vault.symbol}: ${balance}`);
    });
    
## List all of my pools i've staked in

    const {HarvestSDK} = require("@harvestfi/harvest-sdk/harvest");
    const wallet = new ethers.Wallet('<PRIVATE KEY HERE>');
    
    const harvest = new HarvestSDK({signerOrProvider: wallet});
    
    const myPools = harvest.myPools();
    
    (await myPools).forEach(({pool, balance}) => {
        console.log(`${pool.name} ${ethers.utils.formatUnits(balance, 18)}`);
    });

## Deposit and stake all of a token

    // initialise the harvest SDK
    const {HarvestSDK} = require("@harvestfi/harvest-sdk/harvest");
    const wallet = new ethers.Wallet('<PRIVATE KEY HERE>');
    const harvest = new HarvestSDK({signerOrProvider: wallet});
    
    // convert 1 eth to weth
    const weth = new ethers.Contract('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', wethAbi, signer);
    await weth.deposit({value: ethers.utils.parseEther("1")});

    // find the weth vault
    const wethVault = (await harvest.vaults()).findByName("WETH"); // search is case insensitive

    // deposit and stake ALL YOUR WETH
    const pool = await harvest.depositAndStake(wethVault, await wethVault.underlyingToken().balanceOf(await wallet.getAddress()));

    console.log(`You are now in the WETH pool with a staked balance of : ${(await pool.balanceOf(await signer.getAddress())).toString()}`);

# Anonymous Usage

You don't always need to use a provider to get some information out of the sdk.

For example you can list all the available vaults:

    const {HarvestSDK} = require("@harvestfi/harvest-sdk/harvest");
    const harvest = new  HarvestSDK({chainId: Chain.ETH}); // eth mainnet
    const vaultContainer = await harvest.vaults();

    vaultContainer.vaults.forEach(vault => {
        console.log(`${vault.symbol} ${vault.address}`);
    })
    
    
Additionally you can do the same for the pools:

    const {HarvestSDK} = require("@harvestfi/harvest-sdk/harvest");
    const harvest = new  HarvestSDK({chainId: Chain.ETH}); // eth mainnet
    const poolContainer = await harvest.pools();

    poolContainer.pools.forEach(pool => {
        console.log(`${pool.symbol} ${pool.address}`);
    })

# Testing

You can run tests by using this command:

    npx hardhat test
