import { jsonString } from '@utils/formatters';
import { parseQueryFields } from '@utils/parsers';
import { Request, Response } from 'express';
import { error, log } from '@utils/logger';
import { StatusCode } from '@base/types/StatusCode';
import { NFTDataSource, nftDataSources } from '@base/types/Queries';
import { getAssetsFromCovalent } from '@services/covalent/getAssetsFromCovalent';
import { getUserAssetsFromUnmarshall } from '@services/unmarshal/getUserAssetsFromUnmarshal';
import { getAssetsFromOpenSeaByUser } from '@services/opensea/assets/getAssetsFromOpenseaByUser';

export const getUserAssets = async (req: Request<{ user: string }>, res: Response) => {
  await fetchAssetsOfUser(req, res);
};

export async function fetchAssetsOfUser(req: Request<{ user: string }>, res: Response) {
  const user = (`${req.params.user}` || '').trim().toLowerCase();
  const { source } = req.query;
  const contract = req.query.contract ?? '';
  const queries = parseQueryFields(res, req, ['limit', 'offset'], ['50', `0`]);
  if ('error' in queries) {
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
    const assets = await getAssets(user, queries.limit, queries.offset, sourceName, contract as string);

    if (!assets) {
      res.sendStatus(StatusCode.InternalServerError);
      return;
    }

    const resp = jsonString(assets);
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

export async function getAssets(
  address: string,
  limit: number,
  offset: number,
  sourceName: NFTDataSource,
  contract?: string
) {
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
      data = await getUserAssetsFromUnmarshall(address, contract);
      break;
    case NFTDataSource.OpenSea:
      data = await getAssetsFromOpenSeaByUser(address, offset, limit);
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
