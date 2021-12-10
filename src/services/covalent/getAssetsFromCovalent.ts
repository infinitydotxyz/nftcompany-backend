import { saveRawCovalentAssetInDatabase } from '@services/infinity/assets/saveAsset';
import { error, log } from '@utils/logger';
import axios from 'axios';

export async function getAssetsFromCovalent(chainId: string, tokenId: string, tokenAddress: string) {
  log('Getting asset from Covalent');
  const apiBase = 'https://api.covalenthq.com/v1/';
  const authKey = process.env.covalentKey;
  const url = apiBase + chainId + '/tokens/' + tokenAddress + '/nft_metadata/' + tokenId + '/&key=' + authKey;
  try {
    const { data } = await axios.get(url);
    const items = data.data.items;

    if (items.length > 0) {
      // save in db for future use
      return await saveRawCovalentAssetInDatabase(chainId, items[0]);
    } else {
      return '';
    }
  } catch (err) {
    error('Error occured while fetching assets from covalent');
    error(err);
  }
}
