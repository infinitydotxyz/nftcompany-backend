import { jsonString } from '@utils/formatters';
import { parseQueryFields } from '@utils/parsers';
import { Request, Response } from 'express';
import { error, log } from '@utils/logger';
import { StatusCode } from '@base/types/StatusCode';
import { NFTDataSource, nftDataSources } from '@base/types/Queries';
import { getUserAssetsFromCovalent } from '@services/covalent/getUserAssetsFromCovalent';
import { getUserAssetsFromUnmarshal } from '@services/unmarshal/getUserAssetsFromUnmarshal';
import { getUserAssetsFromOpenSea } from '@services/opensea/assets/getUserAssetsFromOpensea';
import { getUserAssetsFromAlchemy } from '@services/alchemy/getUserAssetsFromAlchemy';
import { AlchemyUserAssetResponse } from '@services/alchemy/types/AlchemyUserAsset';
import { validateInputs } from '@utils/index';

export const getUserAssets = async (
  req: Request<
    { user: string },
    any,
    any,
    { source: string; collectionIds?: string; contract: string; chainId: string; pageKey: string }
  >,
  res: Response
) => {
  const user = (`${req.params.user}` || '').trim().toLowerCase();
  const { source, collectionIds, chainId, pageKey } = req.query;
  const sourceName = nftDataSources[source];
  const contract = req.query.contract ?? '';
  const queries = parseQueryFields(res, req, ['limit', 'offset'], ['50', `0`]);
  if ('error' in queries) {
    res.sendStatus(StatusCode.InternalServerError);
    return;
  }
  const errorCode = validateInputs({ user, sourceName, chainId }, ['user', 'sourceName', 'chainId']);
  if (errorCode) {
    res.sendStatus(errorCode);
    return;
  }
  try {
    const assets = await getAssets(
      user,
      chainId,
      queries.limit,
      queries.offset,
      sourceName,
      pageKey,
      contract,
      collectionIds as string
    );

    if (!assets) {
      res.sendStatus(StatusCode.InternalServerError);
      return;
    }

    const resp = jsonString(assets);
    // to enable cdn cache
    res.set({
      'Cache-Control': 'must-revalidate, max-age=30',
      'Content-Length': Buffer.byteLength(resp ?? '', 'utf8')
    });
    res.send(resp);
  } catch (err) {
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};

export async function getAssets(
  address: string,
  chainId: string,
  limit: number,
  offset: number,
  sourceName: NFTDataSource,
  pageKey?: string,
  contract?: string,
  collectionIds?: string
) {
  log(`Fetching assets for: ${address} From ${sourceName}`);
  let data;
  switch (sourceName) {
    case NFTDataSource.Infinity:
      data = await getUserAssetsFromInfinity(address, offset, limit);
      break;
    case NFTDataSource.Alchemy:
      data = await getUserAssetsFromAlchemy(address, chainId, pageKey, collectionIds);
      break;
    case NFTDataSource.Unmarshal:
      data = await getUserAssetsFromUnmarshal(address, chainId, offset + 1, limit, contract); // offset + 1 because Unmarshal starts index from 1
      break;
    case NFTDataSource.OpenSea:
      data = await getUserAssetsFromOpenSea(address, offset, limit, collectionIds);
      break;
    case NFTDataSource.Covalent:
      data = await getUserAssetsFromCovalent(address);
      break;
    default:
      log('Invalid data source for fetching nft data of wallet');
      throw new Error(`invalid data source ${sourceName}`);
  }
  // prepare response
  const resp = {} as any;
  if (sourceName === NFTDataSource.Alchemy) {
    const result = data as AlchemyUserAssetResponse;
    resp.count = result?.ownedNfts?.length || 0;
    resp.assets = result?.ownedNfts || [];
    resp.pageKey = result?.pageKey;
  } else {
    data = data || [];
    resp.count = data.length;
    resp.assets = data;
  }
  return resp;
}

async function getUserAssetsFromInfinity(address: string, offset: number, limit: number) {
  log('Fetching user assets from infinity');
}
