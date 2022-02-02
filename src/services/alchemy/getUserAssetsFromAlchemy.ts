import { error, log } from '@utils/logger';
import axios, { AxiosResponse } from 'axios';
import { AlchemyUserAssetResponse } from './types/AlchemyUserAsset';
import { alchemyParamSerializer } from '@base/utils/formatters';
import { ALCHEMY_NFT_BASE_URL_ETH_MAINNET, ALCHEMY_NFT_BASE_URL_POLYGON_MAINNET } from '@base/constants';

/**
 * Docs: https://docs.alchemy.com/alchemy/enhanced-apis/nft-api/
 */

export async function getUserAssetsFromAlchemy(
  userAddress: string,
  chainId: string,
  pageKey?: string,
  collectionIds?: string
) {
  log('Fetching assets from alchemy for user', userAddress, 'chainId', chainId, 'contracts', collectionIds);
  try {
    const alchemyClient = axios.create({
      baseURL: getAlchemyBaseUrl(chainId),
      paramsSerializer: alchemyParamSerializer
    });
    const path = `/getNFTs/`;
    const params = {
      owner: userAddress,
      withMetadata: true
    };
    const collectionIdsArr = collectionIds?.split(',');
    if (collectionIdsArr?.length) {
      // eslint-disable-next-line @typescript-eslint/dot-notation
      params['contractAddresses'] = collectionIdsArr;
    }
    if (pageKey) {
      // eslint-disable-next-line @typescript-eslint/dot-notation
      params['pageKey'] = pageKey;
    }
    const { data }: AxiosResponse<AlchemyUserAssetResponse> = await alchemyClient.get(path, {
      params
    });
    return data;
  } catch (err) {
    error('Error occured while fetching assets from alchemy');
    error(err);
  }
}

export function getAlchemyBaseUrl(chainId: string): string {
  if (chainId === '1') {
    return ALCHEMY_NFT_BASE_URL_ETH_MAINNET;
  } else if (chainId === '137') {
    return ALCHEMY_NFT_BASE_URL_POLYGON_MAINNET;
  }
  throw Error('Unknown chainId. Alchemy does not recognize chainId: ' + chainId);
}
