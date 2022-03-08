import { jsonString } from 'utils/formatters';
import { parseQueryFields } from 'utils/parsers';
import { Request, Response } from 'express';
import { error, log } from 'utils/logger';
import { StatusCode, NFTDataSource, nftDataSources, AssetResponse, Asset } from '@infinityxyz/types/core';
import { getUserAssetsFromCovalent } from 'services/covalent/getUserAssetsFromCovalent';
import { getUserAssetsFromUnmarshal } from 'services/unmarshal/getUserAssetsFromUnmarshal';
import { getUserAssetsFromOpenSea } from 'services/opensea/assets/getUserAssetsFromOpensea';
import { getUserAssetsFromAlchemy } from 'services/alchemy/getUserAssetsFromAlchemy';
import { AlchemyUserAssetResponse } from '@infinityxyz/types/services/alchemy';
import { validateInputs, hexToDecimalTokenId, trimLowerCase } from 'utils/index';
import { UnmarshalUserAssetResponse } from '@infinityxyz/types/services/unmarshal';
import { CovalentWalletBalanceItem } from '@infinityxyz/types/services/covalent';
import { WyvernAssetData } from '@infinityxyz/types/protocols/wyvern';
import FirestoreBatchHandler from 'databases/FirestoreBatchHandler';
import { firestore } from 'container';
import { fstrCnstnts } from '../../../constants';

export const getUserAssets = async (
  req: Request<
    { user: string },
    any,
    any,
    { source: string; collectionIds?: string; contract: string; chainId: string; pageKey: string }
  >,
  res: Response
) => {
  const user = trimLowerCase(req.params.user);
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
    const data = await getAssets(
      user,
      chainId,
      queries.limit,
      queries.offset,
      sourceName,
      pageKey,
      contract,
      collectionIds as string
    );

    if (!data) {
      res.sendStatus(StatusCode.InternalServerError);
      return;
    }

    const resp = jsonString(data);
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
): Promise<Partial<AssetResponse>> {
  log(`Fetching assets for: ${address} From ${sourceName}`);
  let resp: Partial<AssetResponse> = {
    count: 0,
    assets: []
  };
  switch (sourceName) {
    case NFTDataSource.Infinity:
    case NFTDataSource.Alchemy:
      resp = await getUserAssetsFromAlchemy(address, chainId, pageKey, collectionIds);
      resp.count = resp?.ownedNfts?.length;
      resp.assets = resp?.ownedNfts;
      // store in firestore
      storeAlchemyAssetsInFirestore(address, chainId, resp as AlchemyUserAssetResponse);
      break;
    case NFTDataSource.Unmarshal:
      // offset + 1 because Unmarshal starts index from 1
      resp = await getUserAssetsFromUnmarshal(address, chainId, offset + 1, limit, contract);
      resp.count = resp?.nft_assets?.length;
      resp.assets = resp?.nft_assets;
      // store in firestore
      storeUnmarshalAssetsInFirestore(address, chainId, resp as UnmarshalUserAssetResponse);
      break;
    case NFTDataSource.OpenSea:
      resp.assets = await getUserAssetsFromOpenSea(address, offset, limit, collectionIds);
      resp.count = resp.assets?.length;
      // store in firestore
      storeOpenSeaAssetsInFirestore(address, chainId, resp.assets);
      break;
    case NFTDataSource.Covalent:
      resp.assets = await getUserAssetsFromCovalent(address);
      resp.count = resp.assets?.length;
      // store in firestore
      storeCovalentAssetsInFirestore(address, chainId, resp.assets);
      break;
    default:
      log('Invalid data source for fetching nft data of wallet');
      throw new Error(`invalid data source ${sourceName}`);
  }
  return resp;
}

function storeAlchemyAssetsInFirestore(user: string, chainId: string, data: AlchemyUserAssetResponse) {
  const assets: Asset[] = [];
  for (const datum of data?.ownedNfts) {
    const tokenId = hexToDecimalTokenId(datum.id.tokenId);
    const asset: Asset = {
      owner: user,
      collectionAddress: datum.contract.address,
      tokenId,
      chainId
    };
    assets.push(asset);
  }
  saveAssetsToFirestore(assets);
}

function storeUnmarshalAssetsInFirestore(user: string, chainId: string, data: UnmarshalUserAssetResponse) {
  const assets: Asset[] = [];
  for (const datum of data?.nft_assets) {
    const tokenId = hexToDecimalTokenId(datum.token_id);
    const asset: Asset = {
      owner: user,
      collectionAddress: datum.asset_contract,
      tokenId,
      chainId
    };
    assets.push(asset);
  }
  saveAssetsToFirestore(assets);
}

function storeOpenSeaAssetsInFirestore(user: string, chainId: string, data: WyvernAssetData[]) {
  const assets: Asset[] = [];
  for (const datum of data) {
    const tokenId = hexToDecimalTokenId(datum.token_id);
    const asset: Asset = {
      owner: user,
      collectionAddress: datum.asset_contract.address,
      tokenId,
      chainId
    };
    assets.push(asset);
  }
  saveAssetsToFirestore(assets);
}

function storeCovalentAssetsInFirestore(user: string, chainId: string, data: CovalentWalletBalanceItem[]) {
  const assets: Asset[] = [];
  for (const datum of data) {
    const tokenId = hexToDecimalTokenId(datum.nft_data[0].token_id);
    const asset: Asset = {
      owner: user,
      collectionAddress: datum.contract_address,
      tokenId,
      chainId
    };
    assets.push(asset);
  }
  saveAssetsToFirestore(assets);
}

function saveAssetsToFirestore(assets: Asset[]) {
  try {
    const fsBatchHandler = new FirestoreBatchHandler();
    for (const asset of assets) {
      const docId = firestore.getDocIdHash({
        chainId: asset.chainId,
        tokenId: asset.tokenId,
        collectionAddress: asset.collectionAddress
      });
      const docRef = firestore.db.collection(fstrCnstnts.ASSETS_COLL).doc(docId);
      fsBatchHandler.add(docRef, asset, { merge: true });
    }
  } catch (err: any) {
    error('Failed saving user assets to firestore');
  }
}
