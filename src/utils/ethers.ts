import { POLYGON_WYVERN_EXCHANGE_ADDRESS, WYVERN_EXCHANGE_ADDRESS } from '@constants';
import { ethers } from 'ethers';

const ethProvider = new ethers.providers.JsonRpcProvider(process.env.alchemyJsonRpcEthMainnet);
const polygonProvider = new ethers.providers.JsonRpcProvider(process.env.polygonRpc);

export function getProvider(chainId: string) {
  if (chainId === '1') {
    return ethProvider;
  } else if (chainId === '137') {
    return polygonProvider;
  }
  return null;
}

export function getExchangeAddress(chainId: string) {
  if (chainId === '1') {
    return WYVERN_EXCHANGE_ADDRESS;
  } else if (chainId === '137') {
    return POLYGON_WYVERN_EXCHANGE_ADDRESS;
  }
  return null;
}
