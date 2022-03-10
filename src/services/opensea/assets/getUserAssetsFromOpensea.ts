import { WyvernAssetData } from '@infinityxyz/lib/types/protocols/wyvern';
import { OPENSEA_API } from '../../../constants';
import { error, log } from '@infinityxyz/lib/utils';
import { AxiosResponse } from 'axios';
import { openseaClient } from '../utils';

export async function getUserAssetsFromOpenSea(
  userAddress: string,
  offset: number,
  limit: number,
  collectionIds?: string
): Promise<WyvernAssetData[]> {
  log('Fetching assets from opensea');
  const url = OPENSEA_API + 'assets/';
  const options = {
    params: {
      limit,
      offset,
      owner: userAddress
    }
  };

  if (collectionIds) {
    const collectionIdsArr = collectionIds.split(',');
    if (collectionIdsArr.length > 1) {
      // eslint-disable-next-line @typescript-eslint/dot-notation
      options.params['asset_contract_addresses'] = collectionIdsArr;
    } else {
      // eslint-disable-next-line @typescript-eslint/dot-notation
      options.params['asset_contract_address'] = collectionIdsArr[0];
    }
  }

  try {
    const { data }: AxiosResponse<{ assets: WyvernAssetData[] }> = await openseaClient.get(url, options);
    return data?.assets;
  } catch (err) {
    error('Error occured while fetching assets from opensea');
    error(err);
  }
  return [];
}
