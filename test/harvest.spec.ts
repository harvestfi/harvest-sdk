import * as dotenv from 'dotenv';
import {withImpersonation} from "./utils";
import {expect} from 'chai';
import {HarvestSDK} from "../src/harvest";
import {Chain} from "../src/chain";
import {BigNumber} from "ethers";
import vaultAbi from '../src/abis/vault.json';
import wethAbi from '../src/abis/weth.json';
import {InsufficientVaultBalanceError, InvalidAmountError} from "../src/errors";

const hre = require("hardhat");
const ethers = hre.ethers;

const erc20 = require('@openzeppelin/contracts/build/contracts/ERC20.json');
const addr = '0x7BA605bC00eA26512a639D5e0335EAEb3e81aD94';
dotenv.config();

describe('Harvest SDK', async () => {

    const farm_crvTricypto = "0x33ED34dD7C40EF807356316B484d595dDDA832ab"; // collateral
    const pfcrvTricrypto = "0xfbfbe380489882831dad5258cfd2e29307e23b82"; //
    const crvTricrypto = '0xc4AD29ba4B3c580e6D59105FFf484999997675Ff';

    beforeEach(async () => {
        return await hre.network.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_ETH_API_KEY}`,
                        blockNumber: 13332361,
                    },
                },
            ],
        });
    });

    describe("tokens", async () => {
        it('should allow me to gets tokens by name', async () => {

            const [signer] = await ethers.getSigners();
            const harvest = new HarvestSDK(signer); // eth mainnet
            const erc20 = await harvest.erc20s(Chain.ETH);

            const usdcByName = erc20.findTokenByName("USDC");
            const wethByName = erc20.findTokenByName("WETH");
            const usdcByAddress = erc20.findTokenByAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");

            expect(wethByName?.name).to.be.eq("WETH");
            expect(wethByName?.address).to.be.eq("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2");
            expect(usdcByName?.name).to.be.eq("USDC");
            expect(usdcByName?.address).to.be.eq("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
            expect(usdcByAddress?.name).to.be.eq("USDC");
            expect(usdcByAddress?.address).to.be.eq("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");

        }).timeout(20000);
    });

    describe("vaults", async () => {

        it('should allow me to gets vaults by name', async () => {
            await withImpersonation(addr)(async (signer) => {
                const harvest = new HarvestSDK(signer); // eth mainnet
                const vaults = await harvest.vaults(Chain.ETH);

                const maybeVault = vaults.findByName("crvTricrypto");
                // should only be 1 vault with this name.
                expect(maybeVault).to.not.be.eq(undefined);
                expect(maybeVault?.address).to.be.eq(farm_crvTricypto);
                expect(maybeVault.tokens[0]).to.be.eq(crvTricrypto);
            });

        }).timeout(20000);

    });

    it("should complain when i have zero allowance", async () => {

        const [signer] = (await ethers.getSigners());

        const weth = new ethers.Contract('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', wethAbi, signer);
        // swap eth for weth using the weth contract (pre-amble)
        await weth.deposit({value: ethers.utils.parseEther("1")});

        const harvest = new HarvestSDK((signer)); // eth mainnet
        const vaults = await harvest.vaults(Chain.ETH);

        const wethVault = vaults.findByName("WETH");
        const wethVaultBalanceBefore = await wethVault.balanceOf(await signer.getAddress());

        expect(wethVaultBalanceBefore.toNumber()).to.be.eq(0); // preliminary expectation that a new user has a zero balance in the weth vault

        try {
            await harvest.deposit(wethVault, BigNumber.from(123));
            expect(true).to.be.eq(false, "The deposit should fail, not succeed.");
        } catch(e){
            // hide the exception this is expected to fail
        }

    });

    it("should allow me to deposit into a single token vault", async () => {

        const [signer] = (await ethers.getSigners());
        const signerAddress = await signer.getAddress();

        const weth = new ethers.Contract('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', wethAbi, signer);
        // swap eth for weth using the weth contract (pre-amble)
        const amountInGwei = ethers.utils.parseEther("1");
        await weth.deposit({value: amountInGwei});

        const harvest = new HarvestSDK(signer); // eth mainnet
        const vaults = await harvest.vaults(Chain.ETH);

        const wethVault = vaults.findByName("WETH");
        const balanceBefore = await wethVault.balanceOf(signerAddress);

        await harvest.approve(wethVault, amountInGwei);
        await harvest.deposit(wethVault, amountInGwei);
        expect((await wethVault.balanceOf(signerAddress)).gt(balanceBefore)).to.be.eq(true);

    });

    it("should allow me to deposit into lp token vault", async () => {
        await withImpersonation(addr)(async (signer) => {
            const harvest = new HarvestSDK(signer); // eth mainnet
            const vaults = await harvest.vaults(Chain.ETH);

            const crvTriCryptoVault = vaults.findByName("crvtricrypto");

            /**
             * withdraw from the vault to start with, and we should get our LP token back into our wallet
             * - this saves us having to purchase more crvtricrypto tokens from curve.fi
             */
            await harvest.withdraw(crvTriCryptoVault, await crvTriCryptoVault.balanceOf(await signer.getAddress()));

            const underlyingContract = crvTriCryptoVault.underlying();
            const underlyingCrvTriCryptoBalance = await underlyingContract.balanceOf(await signer.getAddress());
            expect(underlyingCrvTriCryptoBalance.gt(0)).to.be.eq(true);

            // ought to work as we've previously approved.
            await harvest.approve(crvTriCryptoVault, underlyingCrvTriCryptoBalance);
            await harvest.deposit(crvTriCryptoVault, underlyingCrvTriCryptoBalance);

        });
    });

    it('should allow me to withdraw a valid balance', async () => {
        await withImpersonation(addr)(async (signer) => {

            const harvest = new HarvestSDK(signer); // eth mainnet
            const vaults = await harvest.vaults(Chain.ETH);

            const maybeVault = vaults.findByName("crvTricrypto");
            // this is the balance of the ftoken version of the lp position
            const farmCrvTricryptoBalance = await maybeVault.balanceOf(addr);
            // expect non-zero balance for test wallet
            expect(farmCrvTricryptoBalance.toString()).to.be.eq("29116707575365064");
            // crvTricrypto contract (owned by curve). the vault wraps this token.
            const crvTricryptoContr = maybeVault.underlying();

            //  farmCrvTricrypto contract (owned by  harvest) will have a share value
            const farmCrvTricryptoContr = new ethers.Contract(farm_crvTricypto, vaultAbi, signer);
            const sharePrice = (await farmCrvTricryptoContr.getPricePerFullShare());
            // calculate expected return from the vault.
            const expectedReturn = farmCrvTricryptoBalance.mul(sharePrice).div(BigNumber.from(10).pow(18));

            // withdraw funds from vault contract
            await harvest.withdraw(maybeVault, farmCrvTricryptoBalance);

            // expect crvTricrypto balance to be back in wallet.
            const walletBalance = await crvTricryptoContr.balanceOf(addr);
            expect(walletBalance.toString()).to.be.eq(expectedReturn.toString());
        });

    }).timeout(20000);

    it("should complain if i ask for a larger balance to withdraw", async () => {
        await withImpersonation(addr)(async (signer) => {

            const harvest = new HarvestSDK(signer); // eth mainnet
            const vaults = await harvest.vaults(Chain.ETH);

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
    }).timeout(20000);

    it("should allow me to stake and unstake a vault token", async () => {
        await withImpersonation(addr)(async (signer) => {

            const harvest = new HarvestSDK(signer); // eth mainnet
            const vaults = await harvest.vaults(Chain.ETH);

            const maybeVault = vaults.findByName("crvTricrypto");
            // this is the balance of the ftoken version of the lp position
            const farmCrvTricryptoOriginalBalance = await maybeVault.balanceOf(addr);

            const pools = await harvest.pools(Chain.ETH);
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
    }).timeout(20000);

    it("should not allow me to stake more vault tokens than I own", async () => {
        await withImpersonation(addr)(async (signer) => {

            const harvest = new HarvestSDK(signer); // eth mainnet
            const vaults = await harvest.vaults(Chain.ETH);

            const maybeVault = vaults.findByName("crvTricrypto");
            // this is the balance of the ftoken version of the lp position
            const farmCrvTricryptoBalance = await maybeVault.balanceOf(addr);

            const pools = await harvest.pools(Chain.ETH);
            const crvTricryptoPool = pools.findByVault(maybeVault);
            await maybeVault.approve(crvTricryptoPool.address, farmCrvTricryptoBalance);

            try {
                await harvest.stake(crvTricryptoPool, farmCrvTricryptoBalance.add(1));
                expect(false).to.be.eq(true, "You should not be able to stake more than you own");
            } catch(e){
                expect(e).to.be.instanceOf(InsufficientVaultBalanceError)
            }

        });
    }).timeout(20000);

    it("should allow me to approve deposit and stake in 1 step", async() => {
        await withImpersonation(addr)(async (signer) => {

            const harvest = new HarvestSDK(signer); // eth mainnet
            const vaults = await harvest.vaults(Chain.ETH);
            const pools = await harvest.pools(Chain.ETH);
            const crvTriCryptoVault = vaults.findByName("crvTricrypto");
            const crvTriCryptoPool = pools.findByVault(crvTriCryptoVault);

            const address = await signer.getAddress();
            /**
             * withdraw from the vault to start with, and we should get our LP token back into our wallet
             * - this saves us having to purchase more crvtricrypto tokens from curve.fi
             */
            await harvest.withdraw(crvTriCryptoVault, await crvTriCryptoVault.balanceOf(address));

            const triCryptoBalance = await crvTriCryptoVault.underlying().balanceOf(address);

            expect((await crvTriCryptoPool.balanceOf(address)).eq(0));
            /**
             * Do entire chain of deposit/stake
             */
            await harvest.depositAndStake(crvTriCryptoVault, triCryptoBalance, Chain.ETH);

            expect((await crvTriCryptoPool.balanceOf(address)).gt(0));

        });
    }).timeout(20000);

    it("should allow me to reap the rewards from a pool", async () => {
        await withImpersonation(addr)(async (signer) => {

            const harvest = new HarvestSDK(signer); // eth mainnet
            const vaults = await harvest.vaults(Chain.ETH);
            const tokens = await harvest.erc20s(Chain.ETH);

            const maybeFarm = tokens.findTokenByName("iFARM");
            const maybeVault = vaults.findByName("crvTricrypto");
            // this is the balance of the ftoken version of the lp position
            const farmCrvTricryptoBalance = await maybeVault.balanceOf(addr);
            const currentFarmBalance = await maybeFarm.balanceOf(addr, signer);

            const pools = await harvest.pools(Chain.ETH);
            const crvTricryptoPool = pools.findByVault(maybeVault);
            // approve spending the vault value into the pool
            await maybeVault.approve(crvTricryptoPool.address, farmCrvTricryptoBalance);

            // stack
            await harvest.stake(crvTricryptoPool, farmCrvTricryptoBalance);
            // claim rewards for staked position
            await crvTricryptoPool.claimRewards();

            const newFarmBalance = await maybeFarm.balanceOf(addr, signer);
            // expect to have an increased rewards balance after at least 1 block tx
            expect(newFarmBalance.gt(currentFarmBalance)).to.be.eq(true);
        });
    }).timeout(20000);

    /**
     * FYI this might fail if the contracts in the tokens/pools are newer than the block
     * we're using for testing, in this situation it's advisable to update the block number
     * in the beforeEach section at the top to a more recent block which should contain the
     * contract you're after.
     */
    it("should allow me to list all my available LP token deposits", async () => {
        await withImpersonation(addr)(async (signer) => {

            const harvest = new HarvestSDK(signer); // eth mainnet
            const myVaults = await harvest.myVaults(addr, Chain.ETH);
            const res = myVaults.reduce((acc: { [key: string]: string }, {vault, balance}) => {
                // console.log(`${vault.name} : ${ethers.utils.formatUnits(balance, vault.decimals)}`);
                const name = vault.name || "";
                acc[name] = ethers.utils.formatUnits(balance, vault.decimals);
                return acc;
            }, {});

            const expectedFixture = {
                "UniV3_ETH_sETH2": "0.33488586169364782",
                "UniV3_zUSD_USDC_full_range": "0.000001060355899832",
                "UniV3_zUSD_ETH": "1.475777225514812291",
                "crvTriCrypto": "0.029116707575365064",
                "UniV3_USDC_ETH": "0.000000208218158038",
                "UniV3_ETH_USDT": "0.000000211406592338",
                "Univ3_BUSD_USDC": "0.142559907390608712",
                "Univ3_renBTC_wBTC": "0.00000000023879433",
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
            };

            expect(res).to.deep.eq(expectedFixture);
        });
    }).timeout(40000);
});


