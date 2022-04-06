import { saveRawCovalentAssetInDatabase } from 'services/infinity/assets/saveAsset';
import { error, log } from '@infinityxyz/lib/utils';
import { covalentClient } from './utils';

/**
 * Docs: https://www.covalenthq.com/docs/api/#/0/Class-A/Get-NFT-external-metadata-for-contract/lng=en
 * @param chainId
 * @param tokenId
 * @param tokenAddress
 * @returns
 */
export async function getAssetFromCovalent(chainId: string, tokenId: string, tokenAddress: string) {
  log('Getting asset from Covalent');
  const path = `${chainId}/tokens/${tokenAddress}/nft_metadata/${tokenId}/`;
  try {
    const { data } = await covalentClient.get(path);
    const items = data.data.items;

    if (items.length > 0) {
      // Save in db for future use
      return await saveRawCovalentAssetInDatabase(chainId, items[0]);
    } else {
      return {
        count: 0,
        listings: []
      };
    }
  } catch (err) {
    error('Error occured while fetching assets from covalent');
    error(err);
  }
}
