import { error, log } from '@utils/logger';
import { CovalentWalletBalanceItem } from './types/CovalentNFTMetadata';
import { covalentClient } from './utils';

export async function getAssetsFromCovalent(address: string) {
  log('Fetching assets from covalent');
  const chainId = '137';
  const path = `${chainId}/address/${address}/balances_v2/`;
  try {
    const { data } = await covalentClient.get(path, {
      params: {
        nft: true,
        'no-nft-fetch': false
      }
    });
    const items: CovalentWalletBalanceItem[] = data.data.items;
    return items;
  } catch (err) {
    error('Error occured while fetching assets from covalent');
    error(err);
  }
}
