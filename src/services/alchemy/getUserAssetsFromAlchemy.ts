import { error, log } from '@utils/logger';
import { AxiosResponse } from 'axios';
import { AlchemyUserAssetResponse } from '@infinityxyz/types/services/alchemy/AlchemyUserAsset';
import { getAlchemyClient } from './utils';

/**
 * Docs: https://docs.alchemy.com/alchemy/enhanced-apis/nft-api/
 */

export async function getUserAssetsFromAlchemy(
  userAddress: string,
  chainId: string,
  pageKey?: string,
  collectionIds?: string
): Promise<Partial<AlchemyUserAssetResponse>> {
  log('Fetching assets from alchemy for user', userAddress, 'chainId', chainId, 'contracts', collectionIds);
  try {
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
    const { data }: AxiosResponse<AlchemyUserAssetResponse> = await getAlchemyClient(chainId).get(path, {
      params
    });
    return data;
  } catch (err) {
    error('Error occured while fetching assets from alchemy');
    error(err);
  }
  return {};
}
