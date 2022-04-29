import {
  ALCHEMY_JSON_RPC_ETH_MAINNET,
  ALCHEMY_JSON_RPC_POLYGON_MAINNET,
  POLYGON_WYVERN_EXCHANGE_ADDRESS,
  WYVERN_EXCHANGE_ADDRESS
} from '../constants';
import { ethers } from 'ethers';

const ethProvider = new ethers.providers.JsonRpcProvider(ALCHEMY_JSON_RPC_ETH_MAINNET);
const polygonProvider = new ethers.providers.JsonRpcProvider(ALCHEMY_JSON_RPC_POLYGON_MAINNET);
const localHostProvider = new ethers.providers.JsonRpcProvider(process.env.localhostRpc);

export function getProvider(chainId: string) {
  if (chainId === '1') {
    return ethProvider;
  } else if (chainId === '137') {
    return polygonProvider;
  } else if (chainId === '31337') {
    return localHostProvider;
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

export function getChainId(chain: string) {
  if (chain.trim().toLowerCase() === 'ethereum') {
    return '1';
  } else if (chain.trim().toLowerCase() === 'polygon') {
    return '137';
  } else if (chain.trim().toLowerCase() === 'localhost') {
    return '31337';
  }
  return '';
}
