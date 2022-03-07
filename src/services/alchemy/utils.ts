import axios, { AxiosInstance } from 'axios';
import { ALCHEMY_NFT_BASE_URL_ETH_MAINNET, ALCHEMY_NFT_BASE_URL_POLYGON_MAINNET } from '../../constants';
import { alchemyParamSerializer } from 'utils/formatters';

// eth mainnet
export const alchemyMainnetClient = axios.create({
  baseURL: ALCHEMY_NFT_BASE_URL_ETH_MAINNET,
  paramsSerializer: alchemyParamSerializer
});

// polygon mainnet
export const alchemyPolygonClient = axios.create({
  baseURL: ALCHEMY_NFT_BASE_URL_POLYGON_MAINNET,
  paramsSerializer: alchemyParamSerializer
});

export function getAlchemyClient(chainId: string): AxiosInstance {
  if (chainId === '1') {
    return alchemyMainnetClient;
  } else if (chainId === '137') {
    return alchemyPolygonClient;
  }
  throw Error('Unknown chainId. Alchemy does not recognize chainId: ' + chainId);
}
