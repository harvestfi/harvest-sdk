// const networks = require('../networks.config');
// switch the networks before including hardhat hre
// networks.hardhat.forking = networks.polygon;
import * as hre from 'hardhat';
import {Signer} from "ethers";
const ethers = hre.ethers;

export const withImpersonation = (impersonationAddress: string) => async <R>(fn: (signer: Signer)  => Promise<R>) => {
  await hre.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [impersonationAddress],
  });
  const signer = await ethers.provider.getSigner(impersonationAddress);
  const res = await fn(signer);
  await hre.network.provider.request({
    method: 'hardhat_stopImpersonatingAccount',
    params: [impersonationAddress],
  });
  return res
};
