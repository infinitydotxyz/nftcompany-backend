import { OPENSEA_API } from '@constants';
import { error, log } from '@utils/logger';
import { saveRawOpenseaAssetInDatabase } from './getAssetsFromOpensea';
import { openseaClient } from '../client';

export async function fetchAssetFromOpensea(chainId: string, tokenId: string, tokenAddress: string) {
  log('Getting asset from Opensea');
  try {
    const url = OPENSEA_API + 'asset/' + tokenAddress + '/' + tokenId;

    const { data } = await openseaClient.get(url);
    // store asset for future use
    return await saveRawOpenseaAssetInDatabase(chainId, data);
  } catch (err) {
    error('Failed to get asset from opensea', tokenAddress, tokenId);
    error(err);
  }
}
