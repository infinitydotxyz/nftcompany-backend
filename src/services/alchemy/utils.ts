import axios, { AxiosInstance } from 'axios';
import { ALCHEMY_JSON_RPC_ETH_MAINNET, ALCHEMY_JSON_RPC_POLYGON_MAINNET } from '../../constants';
import { alchemyParamSerializer } from 'utils/formatters';

// Eth mainnet
export const alchemyMainnetClient = axios.create({
  baseURL: ALCHEMY_JSON_RPC_ETH_MAINNET,
  paramsSerializer: alchemyParamSerializer
});

// Polygon mainnet
export const alchemyPolygonClient = axios.create({
  baseURL: ALCHEMY_JSON_RPC_POLYGON_MAINNET,
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
