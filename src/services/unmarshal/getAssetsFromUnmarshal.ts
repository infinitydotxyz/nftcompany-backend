import { error, log } from '@utils/logger';
import axios from 'axios';

export async function getAssetsFromUnmarshal(address: string) {
  log('Fetching assets from unmarshal');
  const apiBase = 'https://api.unmarshal.com/v1/';
  const chain = 'ethereum';
  const authKey = process.env.unmarshalKey;
  const url = apiBase + chain + '/address/' + address + '/nft-assets?auth_key=' + authKey;
  try {
    const { data } = await axios.get(url);
    return data;
  } catch (err) {
    error('Error occured while fetching assets from unmarshal');
    error(err);
  }
}
