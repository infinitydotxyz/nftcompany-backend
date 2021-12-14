import { error, log } from '@utils/logger';
import { AxiosResponse } from 'axios';
import { CovalentBalance } from './types/CovalentBalance';
import { CovalentWalletBalanceItem } from './types/CovalentNftMetadata';
import { CovalentResponse } from './types/CovalentResponse';
import { covalentClient } from './utils';

export async function getAssetsFromCovalent(address: string) {
  log('Fetching assets from covalent');
  const chainId = '137';
  const path = `${chainId}/address/${address}/balances_v2/`;
  try {
    const { data } = (await covalentClient.get(path, {
      params: {
        nft: true,
        'no-nft-fetch': false
      }
    })) as AxiosResponse<CovalentResponse<CovalentBalance>>;
    const items = data.data.items;
    const resp: { count: number; assets: CovalentWalletBalanceItem[] } = { count: 0, assets: [] };
    for (const item of items) {
      const type = item.type;
      if (type === 'nft') {
        resp.count++;
        resp.assets.push(item);
      }
    }
    return resp;
  } catch (err) {
    error('Error occured while fetching assets from covalent');
    error(err);
  }
}
