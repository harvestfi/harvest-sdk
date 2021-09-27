import * as dotenv from 'dotenv';
import {expect} from 'chai';
import {HarvestSDK} from "../src/harvest";
import {Chain} from "../src/enums";
import {BigNumber, ethers} from "ethers";
import {withImpersonation} from "./utils";
import vaultAbi from '../src/abis/vault.json';

const erc20 = require('@openzeppelin/contracts/build/contracts/ERC20.json');
const addr = '0x7BA605bC00eA26512a639D5e0335EAEb3e81aD94';
dotenv.config();

describe('Harvest SDK', async () => {

    const farm_crvTricypto = "0x33ED34dD7C40EF807356316B484d595dDDA832ab"; // collateral
    const pfcrvTricrypto = "0xfbfbe380489882831dad5258cfd2e29307e23b82"; //
    const crvTricrypto = '0xc4AD29ba4B3c580e6D59105FFf484999997675Ff';

    describe("tokens", async()  => {
        it('should allow me to gets tokens by name', async () => {
            const harvest = new HarvestSDK(Chain.ETH); // eth mainnet
            const erc20 = await harvest.erc20s();

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



    it('should allow me to gets vaults by name', async () => {
        await withImpersonation(addr)(async (signer) => {
            const harvest = new HarvestSDK(Chain.ETH); // eth mainnet
            const vaults = await harvest.vaults();

            const maybeVault = vaults.findByName("crvTricrypto");
            // should only be 1 vault with this name.
            expect(maybeVault).to.not.be.eq(undefined);
            expect(maybeVault?.address).to.be.eq(farm_crvTricypto);
            expect(maybeVault.tokens[0]).to.be.eq(crvTricrypto);

        })

    }).timeout(20000);

    it('should allow me withdraw a valid balance', async () => {
        await withImpersonation(addr)(async (signer) => {

            const harvest = new HarvestSDK(Chain.ETH); // eth mainnet
            const vaults = await harvest.vaults();

            const maybeVault = vaults.findByName("crvTricrypto");
            // this is the balance of the ftoken version of the lp position
            const farmCrvTricryptoBalance = await maybeVault.balanceOf(addr);
            // expect non-zero balance for test wallet
            expect(farmCrvTricryptoBalance.toString()).to.be.eq("29116707575365064");
            // crvTricrypto contract (owned by curve). the vault wraps this token.
            const crvTricryptoContr = new ethers.Contract(maybeVault.tokens[0], erc20.abi, signer);

            //  farmCrvTricrypto contract (owned by  harvest) will have a share value
            const farmCrvTricryptoContr = new ethers.Contract(farm_crvTricypto, vaultAbi, signer);
            const sharePrice = (await farmCrvTricryptoContr.getPricePerFullShare())
            // calculate expected return from the vault.
            const expectedReturn = farmCrvTricryptoBalance.mul(sharePrice).div(BigNumber.from(10).pow(18));

            // withdraw funds from vault contract
            await harvest.withdraw(maybeVault, farmCrvTricryptoBalance, signer);

            // expect crvTricrypto balance to be back in wallet.
            const walletBalance = await crvTricryptoContr.balanceOf(addr);

            expect(walletBalance.toString()).to.be.eq(expectedReturn.toString());
        });

    }).timeout(20000);

    it("should complain if i ask for a larger balance to withdraw",  async() => {
        expect(true).to.be.eq(false);
    }).timeout(20000);

    it("should allow me to stake and unstake a farm wrapped token",  async() => {

        expect(true).to.be.eq(false);
    }).timeout(20000);

    it("should allow me to approve and deposit a token", async() => {
        // buy a new LP token?
        // get the vault
        // approve the amount for the vault
        // internal check this amount is valid first
        // deposit the amount for the vault
        // internal check this amount is valid first
        // check vault balance

        expect(true).to.be.eq(false);
    });
});


