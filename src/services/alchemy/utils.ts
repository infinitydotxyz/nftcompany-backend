import axios, { AxiosInstance } from 'axios';
import { ALCHEMY_NFT_BASE_URL_ETH_MAINNET, ALCHEMY_NFT_BASE_URL_POLYGON_MAINNET } from '@base/constants';
import { alchemyParamSerializer } from '@base/utils/formatters';

export function getAlchemyClient(chainId: string): AxiosInstance {
  return axios.create({
    baseURL: getAlchemyBaseUrl(chainId),
    paramsSerializer: alchemyParamSerializer
  });
}

export function getAlchemyBaseUrl(chainId: string): string {
  if (chainId === '1') {
    return ALCHEMY_NFT_BASE_URL_ETH_MAINNET;
  } else if (chainId === '137') {
    return ALCHEMY_NFT_BASE_URL_POLYGON_MAINNET;
  }
  throw Error('Unknown chainId. Alchemy does not recognize chainId: ' + chainId);
}
