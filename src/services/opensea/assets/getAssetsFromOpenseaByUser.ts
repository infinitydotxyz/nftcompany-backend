import { WyvernAssetData } from '@base/types/wyvern/WyvernOrder';
import { OPENSEA_API } from '@constants';
import { error, log } from '@utils/logger';
import { AxiosResponse } from 'axios';
import { openseaClient } from '../utils';

export async function getAssetsFromOpenSeaByUser(userAddress: string, offset: number, limit: number) {
  log('Fetching assets from opensea');
  const url = OPENSEA_API + 'assets/';

  const options = {
    params: {
      limit,
      offset,
      owner: userAddress
    }
  };

  try {
    const { data }: AxiosResponse<{ assets: WyvernAssetData[] }> = await openseaClient.get(url, options);
    return { count: data.assets.length, assets: data.assets };
  } catch (err) {
    error('Error occured while fetching assets from opensea');
    error(err);
  }
}
