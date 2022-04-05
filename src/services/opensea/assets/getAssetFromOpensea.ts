import { WyvernAssetData } from '@infinityxyz/lib/types/protocols/wyvern';
import { OPENSEA_API } from '../../../constants';
import { error, log } from '@infinityxyz/lib/utils';
import { AxiosResponse } from 'axios';
import { openseaClient, saveRawOpenseaAssetInDatabase } from '../utils';

export async function getAssetFromOpensea(chainId: string, tokenId: string, tokenAddress: string) {
  log('Getting asset from Opensea');
  try {
    const url = OPENSEA_API + 'asset/' + tokenAddress + '/' + tokenId;

    const { data }: AxiosResponse<WyvernAssetData> = await openseaClient.get(url);
    // Store asset for future use
    return await saveRawOpenseaAssetInDatabase(chainId, data);
  } catch (err) {
    error('Failed to get asset from opensea', tokenAddress, tokenId);
    error(err);
  }
}
