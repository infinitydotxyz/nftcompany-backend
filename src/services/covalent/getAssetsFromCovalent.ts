import { error, log } from '@utils/logger';
import axios from 'axios';

export async function getAssetsFromCovalent(address: string) {
  log('Fetching assets from covalent');
  const apiBase = 'https://api.covalenthq.com/v1/';
  const chain = '137';
  const authKey = process.env.covalentKey;
  const url = apiBase + chain + '/address/' + address + '/balances_v2/?nft=true&no-nft-fetch=false&key=' + authKey;
  try {
    const { data } = await axios.get(url);
    const items = data.data.items;
    const resp: { count: number; assets: any[] } = { count: 0, assets: [] };
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
