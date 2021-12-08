import { jsonString } from '@utils/formatters';
import { parseQueryFields } from '@utils/parsers';
import { Request, Response, Router } from 'express';
import { error, log } from '@utils/logger';
import { OPENSEA_API } from '@constants';
import { StatusCode } from '@base/types/StatusCode';
import { NFTDataSource, nftDataSources } from '@base/types/Queries';
import axios from 'axios';

const router = Router();

router.get('/:user/assets', (req, res) => {
  fetchAssetsOfUser(req, res);
});

export default router;

export async function fetchAssetsOfUser(req: Request, res: Response) {
  const user = (`${req.params.user}` || '').trim().toLowerCase();
  const { source } = req.query;
  const {
    limit,
    offset,
    error: err
  }: { limit?: number; offset?: number; error?: number } = parseQueryFields(res, req, ['limit', 'offset'], ['50', `0`]);
  if (err) {
    return;
  }
  if (!user) {
    error('Empty user');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }
  const sourceName = nftDataSources[source as string];
  if (!sourceName) {
    error('Empty sourceName');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }
  try {
    let resp = await getAssets(user, limit, offset, sourceName);
    resp = jsonString(resp);
    // to enable cdn cache
    res.set({
      'Cache-Control': 'must-revalidate, max-age=30',
      'Content-Length': Buffer.byteLength(resp, 'utf8')
    });
    res.send(resp);
  } catch (err) {
    error(err);
    res.sendStatus(500);
  }
}

export async function getAssets(address: string, limit: number, offset: number, sourceName: NFTDataSource) {
  log('Fetching assets for', address);
  const results = await getAssetsFromChain(address, limit, offset, sourceName);
  return results;
}

export async function getAssetsFromChain(address: string, limit: number, offset: number, sourceName: NFTDataSource) {
  let data;
  switch (sourceName) {
    case NFTDataSource.Infinity:
      data = await getAssetsFromNftc(address, limit, offset);
      break;
    case NFTDataSource.Alchemy:
      data = await getAssetsFromAlchemy(address, limit, offset);
      break;
    case NFTDataSource.Unmarshal:
      data = await getAssetsFromUnmarshal(address, limit, offset);
      break;
    case NFTDataSource.OpenSea:
      data = await getAssetsFromOpensea(address, limit, offset);
      break;
    case NFTDataSource.Covalent:
      data = await getAssetsFromCovalent(address, limit, offset);
      break;
    default:
      log('Invalid data source for fetching nft data of wallet');
  }
  return data;
}

export async function getAssetsFromNftc(address: string, limit: number, offset: number) {
  log('Fetching assets from nftc');
}

export async function getAssetsFromAlchemy(address: string, limit: number, offset: number) {
  log('Fetching assets from alchemy');
}

export async function getAssetsFromCovalent(address: string, limit: number, offset: number) {
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
export async function getAssetsFromUnmarshal(address: string, limit: number, offset: number) {
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

export async function getAssetsFromOpensea(address: string, limit: number, offset: number) {
  log('Fetching assets from opensea');
  const authKey = process.env.openseaKey;
  const url = OPENSEA_API + 'assets/?limit=' + limit + '&offset=' + offset + '&owner=' + address;
  const options = {
    headers: {
      'X-API-KEY': authKey
    }
  };
  try {
    const { data } = await axios.get(url, options);
    return data;
  } catch (err) {
    error('Error occured while fetching assets from opensea');
    error(err);
  }
}
