import { OPENSEA_API } from '@constants';
import { openseaClient } from './client';

export async function getOpenseaEvents(queryString: string) {
  const url = OPENSEA_API + `events?${queryString}`;

  const { data } = await openseaClient.get(url);
  // append chain id assuming opensea is only used for eth mainnet
  for (const obj of data.asset_events) {
    obj.chainId = '1';
  }
  return data;
}
