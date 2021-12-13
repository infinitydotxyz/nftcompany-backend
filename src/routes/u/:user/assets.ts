import { jsonString } from '@utils/formatters';
import { parseQueryFields } from '@utils/parsers';
import { Request, Response } from 'express';
import { error, log } from '@utils/logger';
import { StatusCode } from '@base/types/StatusCode';
import { NFTDataSource, nftDataSources } from '@base/types/Queries';
import { getAssetsFromCovalent } from '@services/covalent/getAssetsFromCovalent';
import { getAssetsFromUnmarshal } from '@services/unmarshal/getAssetsFromUnmarshal';
import { getAssetsFromOpenSeaByUser } from '@services/opensea/assets/getAssetsFromOpensea';

export const getUserAssets = (req: Request<{ user: string }>, res: Response) => {
  fetchAssetsOfUser(req, res);
};

export async function fetchAssetsOfUser(req: Request<{ user: string }>, res: Response) {
  const user = (`${req.params.user}` || '').trim().toLowerCase();
  const { source } = req.query;
  const {
    limit,
    offset,
    error: err
  }: { limit?: number; offset?: number; error?: number } = parseQueryFields(res, req, ['limit', 'offset'], ['50', `0`]);
  if (err) {
    res.sendStatus(StatusCode.InternalServerError);
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
    res.sendStatus(StatusCode.InternalServerError);
  }
}

export async function getAssets(address: string, limit: number, offset: number, sourceName: NFTDataSource) {
  log('Fetching assets for', address);
  let data;
  switch (sourceName) {
    case NFTDataSource.Infinity:
      data = await getAssetsFromNftc(address, limit, offset);
      break;
    case NFTDataSource.Alchemy:
      data = await getAssetsFromAlchemy(address, limit, offset);
      break;
    case NFTDataSource.Unmarshal:
      data = await getAssetsFromUnmarshal(address);
      break;
    case NFTDataSource.OpenSea:
      data = getAssetsFromOpenSeaByUser(address, offset, limit);
      break;
    case NFTDataSource.Covalent:
      data = await getAssetsFromCovalent(address);
      break;
    default:
      log('Invalid data source for fetching nft data of wallet');
      throw new Error(`invalid data source ${sourceName}`);
  }
  return data;
}

async function getAssetsFromNftc(address: string, limit: number, offset: number) {
  log('Fetching assets from nftc');
}

async function getAssetsFromAlchemy(address: string, limit: number, offset: number) {
  log('Fetching assets from alchemy');
}
