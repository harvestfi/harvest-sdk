import * as dotenv from 'dotenv';
import {withImpersonation} from "./utils";
import {expect} from 'chai';
import {HarvestSDK} from "../src/harvest";
import {Chain} from "../src/chain";
import {BigNumber} from "ethers";
import wethAbi from '../src/abis/weth.json';
import erc20Abi from '../src/abis/erc20.json';
import {
    InsufficientApprovalError,
    InsufficientPoolBalanceError,
    InsufficientVaultBalanceError,
    InvalidAmountError, InvalidVaultNameError
} from "../src/errors";
import {Pool} from "../src/pool";
import {Vault} from "../src/vault";

const networks = require('../networks.config');
// switch the networks before including hardhat hre
// networks.hardhat.forking = networks.polygon;
const hre = require("hardhat");
const ethers = hre.ethers;

const addr = '0x7BA605bC00eA26512a639D5e0335EAEb3e81aD94';
dotenv.config();

describe('Harvest SDK', async () => {

    const wethContractAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    const farm_crvTricypto = "0x33ED34dD7C40EF807356316B484d595dDDA832ab"; // collateral
    const pfcrvTricrypto = "0xfbfbe380489882831dad5258cfd2e29307e23b82"; // pooled vault
    const crvTricrypto = '0xc4AD29ba4B3c580e6D59105FFf484999997675Ff';

    beforeEach(async () => {
        // reset the block
        await hre.network.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: networks.hardhat.forking.url,
                        blockNumber: networks.hardhat.forking.blockNumber,
                    },
                },
            ],
        });
        // pre-fund the address balance
        const [hardhatSigner] = (await ethers.getSigners());
        const tx = await hardhatSigner.sendTransaction({to: addr, value: ethers.utils.parseEther("1.0")});
        return await tx.wait();
    });

    describe("initialisation", async () => {

        it("should allow me to be initialised purely by ChainId (ETH)", async () => {
            const harvest = new HarvestSDK({chainId: Chain.ETH});
            const vaultsContainer = await harvest.vaults();
            expect(vaultsContainer.vaults.length).to.be.gt(0);
            vaultsContainer.vaults.forEach(vault => {
                expect(vault.chainId).to.be.eq(Chain.ETH);
            })

        });

        it("should allow me to be initialised purely by ChainId (BSC)", async () => {
            const harvest = new HarvestSDK({chainId: Chain.BSC});
            const vaultsContainer = await harvest.vaults();
            expect(vaultsContainer.vaults.length).to.be.gt(0);
            vaultsContainer.vaults.forEach(vault => {
                expect(vault.chainId).to.be.eq(Chain.BSC);
            })

        });

        it("should allow me to be initialised purely by ChainId (POLYGON)", async () => {
            const harvest = new HarvestSDK({chainId: Chain.POLYGON});
            const vaultsContainer = await harvest.vaults();
            expect(vaultsContainer.vaults.length).to.be.gt(0);
            vaultsContainer.vaults.forEach(vault => {
                expect(vault.chainId).to.be.eq(Chain.POLYGON);
            })
        });
    });

    describe("tokens", async () => {

        it('should allow me to gets tokens by name', async () => {
            const [hardhatSigner] = (await ethers.getSigners());
            const harvest = new HarvestSDK({signerOrProvider: hardhatSigner, chainId: Chain.ETH}); // eth mainnet
            const tokens = await harvest.tokens();

            const usdcByName = tokens.findTokenBySymbol("USDC");
            const wethByName = tokens.findTokenBySymbol("WETH");
            const usdcByAddress = tokens.findTokenByAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");

            expect(wethByName?.symbol).to.be.eq("WETH");
            expect(wethByName?.address).to.be.eq("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2");
            expect(usdcByName?.symbol).to.be.eq("USDC");
            expect(usdcByName?.address).to.be.eq("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
            expect(usdcByAddress?.symbol).to.be.eq("USDC");
            expect(usdcByAddress?.address).to.be.eq("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");

        });

        it("should allow me to list all my candidate tokens that can be deposited", async () => {
            const [hardhatSigner] = (await ethers.getSigners());
            const harvest = new HarvestSDK({signerOrProvider: hardhatSigner, chainId: Chain.ETH}); // eth mainnet
            const tokens = await harvest.myTokens(addr); // expect the sample wallet to contain "some" depositable tokens
            expect(tokens.length).to.be.gt(0);

        });
    });

    describe("vaults", async () => {

        it('should allow me to gets vaults by name', async () => {
            const harvest = new HarvestSDK({chainId: Chain.ETH}); // eth mainnet
            const vaults = await harvest.vaults();

            const maybeVault = vaults.findByName("crvTricrypto");
            // should only be 1 vault with this name.
            expect(maybeVault).to.not.be.eq(undefined);
            expect(maybeVault?.address).to.be.eq(farm_crvTricypto);
            expect(maybeVault.tokens[0]).to.be.eq(crvTricrypto);
        });

        it("should allow me to list all vaults", async () => {
            const harvest = new HarvestSDK({chainId: Chain.ETH}); // eth mainnet
            const vaultContainer = await harvest.vaults();

            expect(vaultContainer.vaults.length).to.be.gt(0);
            expect(vaultContainer.vaults[0]).to.be.instanceOf(Vault);
        });
        
        it("should throw an error for an invalid vault", async () => {
            const harvest = new HarvestSDK({chainId: Chain.ETH}); // eth mainnet
            const vaults = await harvest.vaults();

            let failed = true;
            try {
                const maybeVault = vaults.findByName("gibberish");
                failed = false;
            } catch (e) {
                expect(e).to.be.instanceOf(InvalidVaultNameError);
                // hide the exception this is expected to fail
            }
            expect(failed).to.be.eq(true, "The lookup should fail, not succeed.");

        });

    });

    describe("pools", async () => {

        it("should allow me to list all pools", async () => {
            const harvest = new HarvestSDK({chainId: Chain.ETH});
            const poolContainer = await harvest.pools();

            expect(poolContainer.pools.length).to.be.gt(0);
            expect(poolContainer.pools[0]).to.be.instanceOf(Pool);
        });

        it("should allow me to list all my pool stakes", async () => {
            await withImpersonation(addr)(async (signer) => {
                const harvest = new HarvestSDK({signerOrProvider: signer, chainId: Chain.ETH}); // eth mainnet
                const myPools = await harvest.myPools();
                expect(myPools.length).to.be.gt(0);
            });
        });
    });

    describe("balance checks", async () => {

        it("should complain when i have zero approved allowance", async () => {

            const [signer] = (await ethers.getSigners());

            // swap eth for weth using the weth contract (pre-amble)
            const weth = new ethers.Contract(wethContractAddress, wethAbi, signer);
            await weth.deposit({value: ethers.utils.parseEther("1")});

            const harvest = new HarvestSDK({signerOrProvider: signer, chainId: Chain.ETH}); // eth mainnet
            const vaults = await harvest.vaults();
            const wethVault = vaults.findByName("WETH");
            const wethVaultBalanceBefore = await wethVault.balanceOf(await signer.getAddress());

            expect(wethVaultBalanceBefore.toNumber()).to.be.eq(0); // preliminary expectation that a new user has a zero balance in the weth vault
            let failed = true;
            try {
                await harvest.deposit(wethVault, BigNumber.from(1));
                failed = false;
            } catch (e) {
                expect(e).to.be.instanceOf(InsufficientApprovalError);
                // hide the exception this is expected to fail
            }
            expect(failed).to.be.eq(true, "The deposit should fail, not succeed.");
        });

        it("should complain when I attempt to deposit but have zero funds", async () => {
            const [signer] = (await ethers.getSigners());

            // swap eth for weth using the weth contract (pre-amble)
            const weth = new ethers.Contract(wethContractAddress, wethAbi, signer);
            await weth.deposit({value: ethers.utils.parseEther("1")});

            const harvest = new HarvestSDK({signerOrProvider: signer, chainId: Chain.ETH}); // eth mainnet
            const vaults = await harvest.vaults();
            const wethVault = vaults.findByName("WETH");
            // allow spending of 1 gwei
            await harvest.approve(wethVault, BigNumber.from(1));
            // withdraw the weth before depositing, this basically causes a disparity in the ability to spend this weth into the vault.
            await weth.withdraw(ethers.utils.parseEther("1"));

            let failed = true;
            try {
                await harvest.deposit(wethVault, BigNumber.from(1));
                failed = false;
            } catch (e) {
                expect(e).to.be.instanceOf(InvalidAmountError);
                // hide the exception this is expected to fail
            }
            expect(failed).to.be.eq(true, "The deposit should fail, not succeed.");
        });

        it("should complain when I attempt to deposit zero", async () => {
            const [signer] = (await ethers.getSigners());

            const harvest = new HarvestSDK({signerOrProvider: signer, chainId: Chain.ETH}); // eth mainnet
            const vaults = await harvest.vaults();
            const wethVault = vaults.findByName("WETH");

            let failed = true;
            try {
                await harvest.deposit(wethVault, BigNumber.from(0));
                failed = false;
            } catch (e) {
                expect(e).to.be.instanceOf(InvalidAmountError);
                // hide the exception this is expected to fail
            }
            expect(failed).to.be.eq(true, "The deposit should fail, not succeed.");
        });

    });

    describe("depositing", async () => {

        it("should allow me to deposit into a single token vault", async () => {

            const [signer] = (await ethers.getSigners());
            const signerAddress = await signer.getAddress();

            const weth = new ethers.Contract(wethContractAddress, wethAbi, signer);
            // swap eth for weth using the weth contract (pre-amble)
            const amountInGwei = ethers.utils.parseEther("1");
            await weth.deposit({value: amountInGwei});

            const harvest = new HarvestSDK({signerOrProvider: signer, chainId: Chain.ETH}); // eth mainnet
            const vaults = await harvest.vaults();

            const wethVault = vaults.findByName("WETH");
            const balanceBefore = await wethVault.balanceOf(signerAddress);

            await harvest.approve(wethVault, amountInGwei);
            await harvest.deposit(wethVault, amountInGwei);
            expect((await wethVault.balanceOf(signerAddress)).gt(balanceBefore)).to.be.eq(true);

        });

        it("should allow me to deposit without re-approving", async () => {

            const [signer] = (await ethers.getSigners());
            const signerAddress = await signer.getAddress();

            const weth = new ethers.Contract('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', wethAbi, signer);
            // swap eth for weth using the weth contract (pre-amble)
            const amountInGwei = ethers.utils.parseEther("1");
            await weth.deposit({value: amountInGwei});

            const harvest = new HarvestSDK({signerOrProvider: signer, chainId: Chain.ETH}); // eth mainnet
            const vaults = await harvest.vaults();

            const wethVault = vaults.findByName("WETH");
            const balanceBefore = await wethVault.balanceOf(signerAddress);

            await harvest.approve(wethVault, amountInGwei);
            await harvest.deposit(wethVault, ethers.utils.parseEther("0.5"));
            const balanceAfterFirstDeposit = await wethVault.balanceOf(signerAddress);
            expect(balanceAfterFirstDeposit.gt(balanceBefore)).to.be.eq(true);

            await harvest.deposit(wethVault, ethers.utils.parseEther("0.5"));
            const balanceAfterSecondDeposit = await wethVault.balanceOf(signerAddress);
            expect(balanceAfterSecondDeposit.gt(balanceAfterFirstDeposit)).to.be.eq(true);
        });

        it("should fail when i deposit more without re-approving", async () => {

            const [signer] = (await ethers.getSigners());
            const signerAddress = await signer.getAddress();

            const weth = new ethers.Contract('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', wethAbi, signer);
            // swap eth for weth using the weth contract (pre-amble)
            const amountInGwei = ethers.utils.parseEther("1");
            await weth.deposit({value: amountInGwei});

            const harvest = new HarvestSDK({signerOrProvider: signer, chainId: Chain.ETH}); // eth mainnet
            const vaults = await harvest.vaults();

            const wethVault = vaults.findByName("WETH");
            const balanceBefore = await wethVault.balanceOf(signerAddress);

            await harvest.approve(wethVault, amountInGwei.div(2));
            await harvest.deposit(wethVault, amountInGwei.div(2));

            const balanceAfterFirstDeposit = await wethVault.balanceOf(signerAddress);
            expect(balanceAfterFirstDeposit.gt(balanceBefore)).to.be.eq(true);

            try {
                await harvest.deposit(wethVault, amountInGwei.div(2));
                expect(true).to.be.eq(false, "If this second deposit works then we've done something weird");
            } catch (e) {
                expect(e).to.be.instanceOf(InsufficientApprovalError);
            }
        });

        it("should allow me to deposit into lp token vault", async () => {
            await withImpersonation(addr)(async (signer) => {
                const harvest = new HarvestSDK({signerOrProvider: signer, chainId: Chain.ETH}); // eth mainnet
                const vaults = await harvest.vaults();

                const crvTriCryptoVault = vaults.findByName("crvtricrypto");

                /**
                 * withdraw from the vault to start with, and we should get our LP token back into our wallet
                 * - this saves us having to purchase more crvtricrypto tokens from curve.fi
                 */
                await harvest.withdraw(crvTriCryptoVault, await crvTriCryptoVault.balanceOf(await signer.getAddress()));

                const underlyingContract = crvTriCryptoVault.underlyingToken();
                const underlyingCrvTriCryptoBalance = await underlyingContract.balanceOf(await signer.getAddress());
                expect(underlyingCrvTriCryptoBalance.gt(0)).to.be.eq(true);

                // ought to work as we've previously approved.
                await harvest.approve(crvTriCryptoVault, underlyingCrvTriCryptoBalance);
                await harvest.deposit(crvTriCryptoVault, underlyingCrvTriCryptoBalance);

            });
        });
    });

    describe("withdrawing", async () => {

        it('should allow me to withdraw a valid balance', async () => {
            await withImpersonation(addr)(async (signer) => {

                const harvest = new HarvestSDK({signerOrProvider: signer, chainId: Chain.ETH}); // eth mainnet
                const vaults = await harvest.vaults();

                const crvTriCryptoVault = vaults.findByName("crvTricrypto");
                // this is the balance of the ftoken version of the lp position
                const farmCrvTricryptoBalance = await crvTriCryptoVault.balanceOf(await signer.getAddress());
                // expect non-zero balance for test wallet
                expect(farmCrvTricryptoBalance.gt(0)).to.be.eq(true);
                // crvTricrypto contract (owned by curve). the vault wraps this token.
                const crvTricryptoContr = crvTriCryptoVault.underlyingToken();
                const sharePrice = (await crvTriCryptoVault.getPricePerFullShare());
                // calculate expected return from the vault.
                const expectedReturn = farmCrvTricryptoBalance.mul(sharePrice).div(BigNumber.from(10).pow(18));

                // withdraw funds from vault contract
                await harvest.withdraw(crvTriCryptoVault, farmCrvTricryptoBalance);

                // expect crvTricrypto balance to be back in wallet.
                const walletBalance = await crvTricryptoContr.balanceOf(addr);
                expect(walletBalance.eq(expectedReturn)).to.be.eq(true);
            });

        });

        it("should complain if i ask for a larger balance to withdraw", async () => {
            await withImpersonation(addr)(async (signer) => {

                const harvest = new HarvestSDK({signerOrProvider: signer, chainId: Chain.ETH}); // eth mainnet
                const vaults = await harvest.vaults();

                const maybeVault = vaults.findByName("crvTricrypto");
                // this is the balance of the ftoken version of the lp position
                const farmCrvTricryptoBalance = await maybeVault.balanceOf(addr);

                try {
                    // withdraw funds greater than balance from vault contract
                    await harvest.withdraw(maybeVault, farmCrvTricryptoBalance.add(1));
                    expect(true).to.eq(false, "Should not be able to withdraw a larger balance");
                } catch (e) {
                    expect(e).to.be.instanceOf(InvalidAmountError);
                }
            });
        });
    });

    describe("staking", () => {

        it("should allow me to stake and unstake a vault token", async () => {
            await withImpersonation(addr)(async (signer) => {

                const harvest = new HarvestSDK({signerOrProvider: signer, chainId: Chain.ETH}); // eth mainnet
                const vaults = await harvest.vaults();

                const maybeVault = vaults.findByName("crvTricrypto");
                // this is the balance of the ftoken version of the lp position
                const farmCrvTricryptoOriginalBalance = await maybeVault.balanceOf(addr);

                const pools = await harvest.pools();
                const crvTricryptoPool = pools.findByVault(maybeVault);
                await maybeVault.approve(crvTricryptoPool.address, farmCrvTricryptoOriginalBalance);

                // stake
                await harvest.stake(crvTricryptoPool, farmCrvTricryptoOriginalBalance);

                // after stake expect the vault balance to be zero
                const farmCrvTricryptoBalanceAfterStake = await maybeVault.balanceOf(addr);
                expect(farmCrvTricryptoBalanceAfterStake.toNumber()).to.be.eq(0);

                //  expect staked balance to equal whatever the vault balance was
                const stakedBalance = await crvTricryptoPool.balanceOf(await signer.getAddress());
                expect(stakedBalance.eq(farmCrvTricryptoOriginalBalance)).to.be.eq(true);

                // unstake
                await harvest.unstake(crvTricryptoPool, stakedBalance);
                // expect vault balance back to what it was and pool balance now zero
                const farmCrvTricryptoBalanceAfterUnstake = await maybeVault.balanceOf(addr);
                expect(farmCrvTricryptoBalanceAfterUnstake.eq(farmCrvTricryptoOriginalBalance)).to.be.eq(true);
                expect((await crvTricryptoPool.balanceOf(addr)).eq(BigNumber.from(0)));

            });
        });

        it("should NOT allow me to stake more vault tokens than I own", async () => {
            await withImpersonation(addr)(async (signer) => {

                const harvest = new HarvestSDK({signerOrProvider: signer, chainId: Chain.ETH}); // eth mainnet
                const vaults = await harvest.vaults();

                const maybeVault = vaults.findByName("crvTricrypto");
                // this is the balance of the ftoken version of the lp position
                const farmCrvTricryptoBalance = await maybeVault.balanceOf(addr);

                const pools = await harvest.pools();
                const crvTricryptoPool = pools.findByVault(maybeVault);
                await maybeVault.approve(crvTricryptoPool.address, farmCrvTricryptoBalance);

                try {
                    await harvest.stake(crvTricryptoPool, farmCrvTricryptoBalance.add(1));
                    expect(false).to.be.eq(true, "You should not be able to stake more than you own");
                } catch (e) {
                    expect(e).to.be.instanceOf(InsufficientVaultBalanceError)
                }

            });
        });

    });

    describe("1 step deposit/staking", async () => {

        it("should allow me to deposit and stake in 1 step", async () => {
            await withImpersonation(addr)(async (signer) => {
                const address = await signer.getAddress();

                const harvest = new HarvestSDK({signerOrProvider: signer, chainId: Chain.ETH}); // eth mainnet
                const vaults = await harvest.vaults();
                const pools = await harvest.pools();
                const crvTriCryptoVault = vaults.findByName("crvTricrypto");
                const crvTriCryptoPool = pools.findByVault(crvTriCryptoVault);

                /**
                 * withdraw from the vault to start with, and we should get our LP token back into our wallet
                 * - this saves us having to purchase more crvtricrypto tokens from curve.fi
                 */
                await harvest.withdraw(crvTriCryptoVault, await crvTriCryptoVault.balanceOf(address));

                const triCryptoBalance = await crvTriCryptoVault.underlyingToken().balanceOf(address);

                expect((await crvTriCryptoPool.balanceOf(address)).eq(0)).to.be.eq(true);
                /**
                 * Do entire chain of deposit/stake
                 */
                await harvest.depositAndStake(crvTriCryptoVault, triCryptoBalance);

                expect((await crvTriCryptoPool.balanceOf(address)).gt(0)).to.be.eq(true);

            });
        });

        it("should allow me to unstake and withdraw in 1 step", async () => {
            await withImpersonation(addr)(async (signer) => {

                const address = await signer.getAddress();
                const harvest = new HarvestSDK({signerOrProvider: signer, chainId: Chain.ETH}); // eth mainnet
                const pools = await harvest.pools();
                /**
                 * use pre-existing pool we should be in
                 */
                const sushiEthPool = pools.findByName("SUSHI-ETH-USDT-HODL");
                const token = await harvest.unstakeAndWithdraw(sushiEthPool, await sushiEthPool.balanceOf(address));
                expect((await token.balanceOf(address)).gt(0));
            });
        });


        it("should complain if i unstake a zero balance", async () => {
            await withImpersonation(addr)(async (signer) => {

                const address = await signer.getAddress();
                const harvest = new HarvestSDK({signerOrProvider: signer, chainId: Chain.ETH}); // eth mainnet
                const pools = await harvest.pools();
                const sushiEthPool = pools.findByName("SUSHI-ETH-USDT");
                expect((await sushiEthPool.balanceOf(address)).toNumber()).to.be.eq(0);
                try {
                    const token = await harvest.unstakeAndWithdraw(sushiEthPool, BigNumber.from(0));
                    expect(true).to.be.eq(false, "This should fail because there is no balance to unstake on this pool.");
                } catch (e) {
                    expect(e).to.be.instanceOf(InsufficientPoolBalanceError);
                }
            });
        });

        it("should allow me to be awesome", async () => {
            // initialise the harvest SDK
            const [signer] = (await ethers.getSigners());
            const harvest = new HarvestSDK({signerOrProvider: signer, chainId: Chain.ETH});

            // convert 1 eth to weth
            const weth = new ethers.Contract(wethContractAddress, wethAbi, signer);
            await weth.deposit({value: ethers.utils.parseEther("1")});

            // find the weth vault
            const wethVault = (await harvest.vaults()).findByName("WETH"); // search is case insensitive

            // deposit and stake ALL YOUR WETH
            const pool = await harvest.depositAndStake(wethVault, await wethVault.underlyingToken().balanceOf(await signer.getAddress()));

            console.log(`You are now in the WETH pool with a staked balance of : ${(await pool.balanceOf(await signer.getAddress())).toString()}`);

        });

    });

    describe("rewards", async () => {

        it("should allow me to figure out what my current rewards are", async () => {
            await withImpersonation(addr)(async (signer) => {

                const harvest = new HarvestSDK({signerOrProvider: signer, chainId: Chain.ETH}); // eth mainnet
                const pools = await harvest.pools();
                const sushiEthUSDTHODLPool = pools.findByName("SUSHI-ETH-USDT-HODL");

                // non-address specific
                const {amount} = await sushiEthUSDTHODLPool.earned();

                expect(amount.gt(0)).to.be.eq(true);
            });
        });

        it("should allow me to figure out what someone else's rewards are", async () => {
            const [signer] = (await ethers.getSigners());
            const harvest = new HarvestSDK({signerOrProvider: signer, chainId: Chain.ETH}); // eth mainnet
            const pools = await harvest.pools();
            const sushiEthUSDTHODLPool = pools.findByName("SUSHI-ETH-USDT-HODL");

            // address specific
            const {amount} = await sushiEthUSDTHODLPool.earned(addr);

            expect(amount.gt(0)).to.be.eq(true);
        });

        it("should allow me to reap the rewards from a pool", async () => {
            await withImpersonation(addr)(async (signer) => {

                const harvest = new HarvestSDK({signerOrProvider: signer, chainId: Chain.ETH}); // eth mainnet
                const pools = await harvest.pools();
                const tokens = await harvest.tokens();
                const maybeiFarm = tokens.findTokenBySymbol("iFARM");
                const maybeFarm = tokens.findTokenBySymbol("FARM");
                const currentiFarmBalance = await maybeiFarm.balanceOf(addr);
                const currentFarmBalance = await maybeFarm.balanceOf(addr);
                const sushiEthUSDTHODLPool = pools.findByName("SUSHI-ETH-USDT-HODL");
                const curveHUSDPool = pools.findByName("farm-curve-husd");

                // approve spending the vault value into the pool
                const iFarm = await sushiEthUSDTHODLPool.claimRewards();
                const farm = await curveHUSDPool.claimRewards();

                const newiFarmBalance = await iFarm.balanceOf(addr);
                const newFarmBalance = await farm.balanceOf(addr);
                // expect to have an increased rewards balance after at least 1 block tx
                expect(newiFarmBalance.gt(currentiFarmBalance)).to.be.eq(true);
                expect(newFarmBalance.gt(currentFarmBalance)).to.be.eq(true);
            });
        });
    });


    describe("returns for exiting", async () => {

        it("should tell me what my returns are if i exit but don't actually exit", async () => {
            await withImpersonation(addr)(async (signer) => {
                const harvest = new HarvestSDK({signerOrProvider: signer, chainId: Chain.ETH}); // eth mainnet
                // select first of my available pools
                const [pool1] = await harvest.myPools();
                await Promise.all([pool1].map(async ({balance, pool}) => {
                    const tokens = await harvest.expectedReturns(pool);
                    expect(tokens.length).to.be.eq(3); // expect back 2 LP tokens and 1 rewards token
                    const [a, b, reward] = tokens;
                    console.log(`POOL [${pool.name}] ${a.token.symbol} [${a.token.address}]: ${ethers.utils.formatUnits(a.amount, a.token.decimals)}`);
                    console.log(`POOL [${pool.name}] ${b.token.symbol} [${b.token.address}]: ${ethers.utils.formatUnits(b.amount, b.token.decimals)}`);
                    console.log(`POOL [${pool.name}] ${reward.token.symbol} [${reward.token.address}]: ${ethers.utils.formatUnits(reward.amount, reward.token.decimals)}`);
                }));
            });
        }).timeout(600000);
    });

    /**
     * FYI this might fail if the contracts in the tokens/pools are newer than the block
     * we're using for testing, in this situation it's advisable to update the block number
     * in the networks.config.ts to a more recent block which should contain the
     * contract you're after.
     */
    it("should allow me to list all my available vault deposits", async () => {
        await withImpersonation(addr)(async (signer) => {

            const harvest = new HarvestSDK({signerOrProvider: signer, chainId: Chain.ETH}); // eth mainnet
            const myVaults = await harvest.myVaults();
            const res = myVaults.reduce((acc: { [key: string]: string }, {vault, balance}) => {
                const name = vault.symbol || "";
                acc[name] = ethers.utils.formatUnits(balance, vault.decimals);
                return acc;
            }, {});

            const expectedFixture = {
                "UniV3_ETH_sETH2": "0.33488586169364782",
                "UniV3_zUSD_USDC_full_range": "0.000001060355899832",
                "crvTriCrypto": "0.029116707575365064",
                "UniV3_USDC_ETH": "0.000000208218158038",
                "UniV3_ETH_USDT": "0.000000211406592338",
                "Univ3_BUSD_USDC": "0.142559907390608712",
                "UniV3_UST_USDT": "0.001449542257980817",
                "UniV3_USDC_USDT": "0.000000015028386154",
                "UniV3_FCASH_USDC": "0.000141102855052733",
                "DAI": "9.466967797837333916",
                "SUSHI-ETH-USDT": "0.000001565689421587",
                "SUSHI-ETH-WBTC": "0.000000004271633019",
                "SUSHI-ETH-UST": "0.1",
                "SUSHI_HODL": "0.709055162810598698",
                "ThreePool": "0.931547681643812964",
                "crvCOMPOUND": "34.013545934721615321",
                "crvUST": "23.807288403558042523",
                "IFARM": "1.439660830690097681",
                "BAC-DAI": "9.397598807784457362",
                "DAI-BAS": "0.228672655401473315",
                "Univ3_USDT_ETH_1400_2400": "0.000000401774118905",
                "DAI-BSG": "0.073921291180446681",
                "DAI-BSGS": "1.497320546865380535",
                "Univ3_DPI_ETH": "0.166488537731537337",
                "UniV3_REI_ETH": "0.054134893184588336",
                "UniV3_REI_wBTC": "0.000199999999972459",
                "Univ3_DAI_ETH_1400_2400": "0.578979189024665702",
                "Univ3_renBTC_wBTC": "0.000000000298670669",
            };

            expect(res).to.deep.eq(expectedFixture);
        });
    });

    describe("crv token separation", async() => {

        it("should work", async () => {
            const [signer] = await ethers.getSigners();
            const yCRV = "0xdF5e0e81Dff6FAF3A7e52BA697820c5e32D806A8";
            const contr = new ethers.Contract("0x73a052500105205d34Daf004eAb301916DA8190f", erc20Abi, signer); // TUSD
            console.log(`${await contr.balanceOf(yCRV)}`);

            // const yPool = '0x45F783CCE6B7FF23B2ab2D70e416cdb7D6055f51';
            // const crvPoolABI = [{"name":"TokenExchange","inputs":[{"type":"address","name":"buyer","indexed":true},{"type":"int128","name":"sold_id","indexed":false},{"type":"uint256","name":"tokens_sold","indexed":false},{"type":"int128","name":"bought_id","indexed":false},{"type":"uint256","name":"tokens_bought","indexed":false}],"anonymous":false,"type":"event"},{"name":"TokenExchangeUnderlying","inputs":[{"type":"address","name":"buyer","indexed":true},{"type":"int128","name":"sold_id","indexed":false},{"type":"uint256","name":"tokens_sold","indexed":false},{"type":"int128","name":"bought_id","indexed":false},{"type":"uint256","name":"tokens_bought","indexed":false}],"anonymous":false,"type":"event"},{"name":"AddLiquidity","inputs":[{"type":"address","name":"provider","indexed":true},{"type":"uint256[4]","name":"token_amounts","indexed":false},{"type":"uint256[4]","name":"fees","indexed":false},{"type":"uint256","name":"invariant","indexed":false},{"type":"uint256","name":"token_supply","indexed":false}],"anonymous":false,"type":"event"},{"name":"RemoveLiquidity","inputs":[{"type":"address","name":"provider","indexed":true},{"type":"uint256[4]","name":"token_amounts","indexed":false},{"type":"uint256[4]","name":"fees","indexed":false},{"type":"uint256","name":"token_supply","indexed":false}],"anonymous":false,"type":"event"},{"name":"RemoveLiquidityImbalance","inputs":[{"type":"address","name":"provider","indexed":true},{"type":"uint256[4]","name":"token_amounts","indexed":false},{"type":"uint256[4]","name":"fees","indexed":false},{"type":"uint256","name":"invariant","indexed":false},{"type":"uint256","name":"token_supply","indexed":false}],"anonymous":false,"type":"event"},{"name":"CommitNewAdmin","inputs":[{"type":"uint256","name":"deadline","indexed":true,"unit":"sec"},{"type":"address","name":"admin","indexed":true}],"anonymous":false,"type":"event"},{"name":"NewAdmin","inputs":[{"type":"address","name":"admin","indexed":true}],"anonymous":false,"type":"event"},{"name":"CommitNewParameters","inputs":[{"type":"uint256","name":"deadline","indexed":true,"unit":"sec"},{"type":"uint256","name":"A","indexed":false},{"type":"uint256","name":"fee","indexed":false},{"type":"uint256","name":"admin_fee","indexed":false}],"anonymous":false,"type":"event"},{"name":"NewParameters","inputs":[{"type":"uint256","name":"A","indexed":false},{"type":"uint256","name":"fee","indexed":false},{"type":"uint256","name":"admin_fee","indexed":false}],"anonymous":false,"type":"event"},{"outputs":[],"inputs":[{"type":"address[4]","name":"_coins"},{"type":"address[4]","name":"_underlying_coins"},{"type":"address","name":"_pool_token"},{"type":"uint256","name":"_A"},{"type":"uint256","name":"_fee"}],"constant":false,"payable":false,"type":"constructor"},{"name":"get_virtual_price","outputs":[{"type":"uint256","name":"out"}],"inputs":[],"constant":true,"payable":false,"type":"function","gas":1535185},{"name":"calc_token_amount","outputs":[{"type":"uint256","name":"out"}],"inputs":[{"type":"uint256[4]","name":"amounts"},{"type":"bool","name":"deposit"}],"constant":true,"payable":false,"type":"function","gas":6067881},{"name":"add_liquidity","outputs":[],"inputs":[{"type":"uint256[4]","name":"amounts"},{"type":"uint256","name":"min_mint_amount"}],"constant":false,"payable":false,"type":"function","gas":9327083},{"name":"get_dy","outputs":[{"type":"uint256","name":"out"}],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"}],"constant":true,"payable":false,"type":"function","gas":3454227},{"name":"get_dx","outputs":[{"type":"uint256","name":"out"}],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dy"}],"constant":true,"payable":false,"type":"function","gas":3454232},{"name":"get_dy_underlying","outputs":[{"type":"uint256","name":"out"}],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"}],"constant":true,"payable":false,"type":"function","gas":3454087},{"name":"get_dx_underlying","outputs":[{"type":"uint256","name":"out"}],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dy"}],"constant":true,"payable":false,"type":"function","gas":3454093},{"name":"exchange","outputs":[],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"},{"type":"uint256","name":"min_dy"}],"constant":false,"payable":false,"type":"function","gas":7030208},{"name":"exchange_underlying","outputs":[],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"},{"type":"uint256","name":"min_dy"}],"constant":false,"payable":false,"type":"function","gas":7050194},{"name":"remove_liquidity","outputs":[],"inputs":[{"type":"uint256","name":"_amount"},{"type":"uint256[4]","name":"min_amounts"}],"constant":false,"payable":false,"type":"function","gas":240409},{"name":"remove_liquidity_imbalance","outputs":[],"inputs":[{"type":"uint256[4]","name":"amounts"},{"type":"uint256","name":"max_burn_amount"}],"constant":false,"payable":false,"type":"function","gas":9326310},{"name":"commit_new_parameters","outputs":[],"inputs":[{"type":"uint256","name":"amplification"},{"type":"uint256","name":"new_fee"},{"type":"uint256","name":"new_admin_fee"}],"constant":false,"payable":false,"type":"function","gas":145867},{"name":"apply_new_parameters","outputs":[],"inputs":[],"constant":false,"payable":false,"type":"function","gas":133482},{"name":"revert_new_parameters","outputs":[],"inputs":[],"constant":false,"payable":false,"type":"function","gas":21805},{"name":"commit_transfer_ownership","outputs":[],"inputs":[{"type":"address","name":"_owner"}],"constant":false,"payable":false,"type":"function","gas":74482},{"name":"apply_transfer_ownership","outputs":[],"inputs":[],"constant":false,"payable":false,"type":"function","gas":60538},{"name":"revert_transfer_ownership","outputs":[],"inputs":[],"constant":false,"payable":false,"type":"function","gas":21895},{"name":"withdraw_admin_fees","outputs":[],"inputs":[],"constant":false,"payable":false,"type":"function","gas":22667},{"name":"kill_me","outputs":[],"inputs":[],"constant":false,"payable":false,"type":"function","gas":37848},{"name":"unkill_me","outputs":[],"inputs":[],"constant":false,"payable":false,"type":"function","gas":21985},{"name":"coins","outputs":[{"type":"address","name":"out"}],"inputs":[{"type":"int128","name":"arg0"}],"constant":true,"payable":false,"type":"function","gas":2160},{"name":"underlying_coins","outputs":[{"type":"address","name":"out"}],"inputs":[{"type":"int128","name":"arg0"}],"constant":true,"payable":false,"type":"function","gas":2190},{"name":"balances","outputs":[{"type":"uint256","name":"out"}],"inputs":[{"type":"int128","name":"arg0"}],"constant":true,"payable":false,"type":"function","gas":2220},{"name":"A","outputs":[{"type":"uint256","name":"out"}],"inputs":[],"constant":true,"payable":false,"type":"function","gas":2051},{"name":"fee","outputs":[{"type":"uint256","name":"out"}],"inputs":[],"constant":true,"payable":false,"type":"function","gas":2081},{"name":"admin_fee","outputs":[{"type":"uint256","name":"out"}],"inputs":[],"constant":true,"payable":false,"type":"function","gas":2111},{"name":"owner","outputs":[{"type":"address","name":"out"}],"inputs":[],"constant":true,"payable":false,"type":"function","gas":2141},{"name":"admin_actions_deadline","outputs":[{"type":"uint256","unit":"sec","name":"out"}],"inputs":[],"constant":true,"payable":false,"type":"function","gas":2171},{"name":"transfer_ownership_deadline","outputs":[{"type":"uint256","unit":"sec","name":"out"}],"inputs":[],"constant":true,"payable":false,"type":"function","gas":2201},{"name":"future_A","outputs":[{"type":"uint256","name":"out"}],"inputs":[],"constant":true,"payable":false,"type":"function","gas":2231},{"name":"future_fee","outputs":[{"type":"uint256","name":"out"}],"inputs":[],"constant":true,"payable":false,"type":"function","gas":2261},{"name":"future_admin_fee","outputs":[{"type":"uint256","name":"out"}],"inputs":[],"constant":true,"payable":false,"type":"function","gas":2291},{"name":"future_owner","outputs":[{"type":"address","name":"out"}],"inputs":[],"constant":true,"payable":false,"type":"function","gas":2321}];
            // const harvest = new HarvestSDK({chainId: Chain.ETH});
            // const vault = (await harvest.vaults()).findByName("YCRV");
        });
    });


    it('should exit my positions', async() => {

        await withImpersonation("0xd1BbcA0dfDe1F51CCd17E33DE1A7EAD48fAa1D68")(async signer => {
            const harvest = new HarvestSDK({signerOrProvider: signer, chainId: Chain.ETH});
            const myPools = await harvest.myPools();
            await Promise.all(myPools.map(async ({balance, pool}) => {
                console.log(`Attempting to unstake and withdraw ${pool.name}`);
                await harvest.unstakeAndWithdraw(pool, balance);
                console.log(`Unstaked and withdrew ${pool.name}`);
            }));

            const myLPs = await harvest.myTokens();
            myLPs.forEach(({balance, token}) => {
                console.log(`I now hold ${token.symbol} [${token.address}] : ${ethers.utils.formatUnits(balance, token.decimals)}`)
            });
        })

    }).timeout(100000);

    it("should allow me to approve", async () => {
        await withImpersonation(addr)(async signer => {
            const harvest = new HarvestSDK({signerOrProvider: signer, chainId: Chain.ETH});
            const vaults = await harvest.vaults();

            // find the appropriate vault
            const crvTriCryptoVault = vaults.findByName("crvTricrypto"); // case insensitive
            // approve full balance of tri crypto LP tokens.
            const balanceOfTriCryptoLP = await crvTriCryptoVault.underlyingToken().balanceOf(await signer.getAddress());
            const tx = await harvest.approve(crvTriCryptoVault, balanceOfTriCryptoLP);

            console.log(tx);
        })
    })

});


