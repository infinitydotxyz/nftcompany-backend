import { error, log } from '@utils/logger';
import { AxiosResponse } from 'axios';
import { UnmarshallUserAsset } from './types/UnmarshallUserAsset';
import { unmarshalClient } from './utils';

/**
 * Docs: https://docs.unmarshal.io/nft-apis/nft-assets-by-address
 */
export async function getUserAssetsFromUnmarshall(userAddress: string, contract?: string) {
  log('Fetching assets from unmarshal');
  const chain = 'matic';
  const path = `${chain}/address/${userAddress}/nft-assets/`;
  try {
    const { data }: AxiosResponse<UnmarshallUserAsset[]> = await unmarshalClient.get(path, {
      params: {
        contract
      }
    });
    return { count: data.length, assets: data };
  } catch (err) {
    error('Error occured while fetching assets from unmarshal');
    error(err);
  }
}
