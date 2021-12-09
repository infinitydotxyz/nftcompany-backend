import { firestore } from '@base/container';
import {
  Asset,
  BaseOrder,
  InfinityOrderData,
  ListingMetadata,
  ListingResponse,
  Trait
} from '@base/types/ListingResponse';
import { OrderSide } from '@base/types/NftInterface';
import { RawAssetData, RawSellOrder, RawTrait } from '@base/types/OSNftInterface';
import { OrderDirection } from '@base/types/Queries';
import { StatusCode } from '@base/types/StatusCode';
import { fstrCnstnts } from '@constants';
import { getOrderTypeFromRawSellOrder } from '@routes/opensea';
import { isTokenVerified } from '@routes/token';
import { deepCopy } from '@utils/index.js';
import { getSearchFriendlyString, jsonString, openseaParamSerializer } from '@utils/formatters';
import { error, log } from '@utils/logger';
import { getFulfilledPromiseSettledResults } from '@utils/promises';
import axios from 'axios';
import { ethers } from 'ethers';
import { Router } from 'express';
import { getAssetAsListing } from '.';
import { off } from 'process';
const router = Router();

router.get('/', async (req, res) => {
  const {
    assetContractAddress,
    paymentTokenAddress,
    maker,
    taker,
    owner,
    isEnglish,
    bundled,
    includeBundled,
    includeInvalid,
    listedAfter,
    listedBefore,
    tokenId,
    tokenIds,
    side,
    saleKind,
    limit,
    offset,
    orderBy,
    orderDirection
  } = req.query;

  const fetchResponse = await fetchOrdersFromOpensea({
    assetContractAddress: assetContractAddress as string,
    paymentTokenAddress: paymentTokenAddress as string,
    maker: maker as string,
    taker: taker as string,
    owner: owner as string,
    isEnglish: Boolean(isEnglish),
    bundled: Boolean(bundled),
    includeBundled: Boolean(includeBundled),
    includeInvalid: Boolean(includeInvalid),
    listedAfter: Number.isNaN(Number(listedAfter)) ? undefined : Number(listedAfter),
    listedBefore: Number.isNaN(Number(listedBefore)) ? undefined : Number(listedBefore),
    tokenId: tokenId as string,
    tokenIds: tokenIds as string[],
    side: Number.isNaN(Number(side)) ? undefined : (Number(side) as OrderSide),
    saleKind: Number.isNaN(Number(saleKind)) ? undefined : Number(saleKind),
    limit: Number.isNaN(Number(limit)) ? undefined : Number(limit),
    offset: Number.isNaN(Number(off)) ? undefined : Number(offset),
    orderBy: orderBy as string,
    orderDirection: orderDirection as string as OrderDirection
  });

  if (fetchResponse.error) {
    res.sendStatus(fetchResponse.error);
    return;
  }

  const resp = fetchResponse.result;
  const stringifiedResp = jsonString(resp);
  if (stringifiedResp) {
    res.set({
      'Cache-Control': 'must-revalidate, max-age=60',
      'Content-Length': Buffer.byteLength(stringifiedResp, 'utf8')
    });
    res.send(stringifiedResp);
  } else {
    res.sendStatus(StatusCode.InternalServerError);
  }
});

async function fetchOrdersFromOpensea({
  assetContractAddress,
  paymentTokenAddress,
  maker,
  taker,
  owner,
  isEnglish,
  bundled,
  includeBundled,
  includeInvalid,
  listedAfter,
  listedBefore,
  tokenId,
  tokenIds,
  side,
  saleKind,
  limit,
  offset,
  orderBy,
  orderDirection
}: {
  assetContractAddress?: string;
  paymentTokenAddress?: string;
  maker?: string;
  taker?: string;
  owner?: string;
  isEnglish?: boolean;
  bundled?: boolean;
  includeBundled?: boolean;
  includeInvalid?: boolean;
  listedAfter?: number;
  listedBefore?: number;
  tokenId?: string;
  tokenIds?: string[];
  side?: OrderSide;
  saleKind: number;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: OrderDirection;
}) {
  log('Fetching Orders from OpenSea');
  const authKey = process.env.openseaKey;
  const url = 'https://api.opensea.io/wyvern/v1/orders/';
  const options = {
    headers: {
      'X-API-KEY': authKey
    },
    params: {
      asset_contract_address: assetContractAddress,
      payment_token_address: paymentTokenAddress,
      maker,
      taker,
      owner,
      is_english: isEnglish,
      bundled,
      include_bundled: includeBundled,
      include_invalid: includeInvalid,
      listed_after: listedAfter,
      listed_before: listedBefore,
      token_id: tokenId,
      token_ids: tokenIds,
      side,
      sale_kind: saleKind,
      limit,
      offset,
      order_by: orderBy,
      order_direction: orderDirection
    },
    paramsSerializer: openseaParamSerializer
  };

  try {
    const { data } = await axios.get(url, options);
    if (data.orders && data.orders.length === 0) {
      return {
        result: {
          count: 0,
          orders: []
        }
      };
    }
    // reduce to one asset per contract/tokenId with a list of openseaListings
    const assetIdToListingIndex: Record<string, number> = {};
    const getOrderData = (listing: any) => {
      const listingCopy = deepCopy(listing);
      delete listingCopy.asset;
      return listingCopy;
    };

    const convertOpenseaOrdersToOpenseaListings = (orders: any) => {
      return orders.reduce(
        (acc: { count: number; listings: any[] }, item: any) => {
          if (item.asset) {
            const id: string = item.asset.id;
            if (!id) {
              return acc;
            }
            let listingIndex = assetIdToListingIndex[id];
            if (listingIndex === undefined) {
              const asset = item.asset;
              const listing = {
                ...asset,
                sell_orders: []
              };
              acc.listings.push(listing);
              listingIndex = acc.listings.length - 1;
              assetIdToListingIndex[id] = listingIndex;
              acc.count += 1;
            }
            const order = getOrderData(item);
            acc.listings[listingIndex].sell_orders.push(order);
          }
          return acc;
        },
        { count: 0, listings: [] }
      );
    };

    const openseaListings = convertOpenseaOrdersToOpenseaListings(data.orders);

    const listingsResponse = await convertOpenseaListingsToInfinityListings(openseaListings.listings);

    const aggregateListingAsOrders = (listings: any) => {
      return listings?.reduce?.(
        (acc: { count: number; orders: any[] }, listing: any) => {
          if (listing) {
            const order = {
              ...listing
            };
            return { count: acc.count + 1, orders: [...acc.orders, order] };
          }
          return acc;
        },
        { count: 0, orders: [] }
      );
    };

    const result = aggregateListingAsOrders(listingsResponse.listings);

    return { result };
  } catch (err) {
    console.log(err.request);
    error('Error occured while fetching orders from opensea');
    error(err);
    return { error: StatusCode.InternalServerError };
  }
}

/**
 *  converts listings
 *
 * @param rawAssetDataArray to be converted to infinity listings
 * @returns an array of listings following the infinity schema
 */
async function convertOpenseaListingsToInfinityListings(rawAssetDataArray: RawAssetData[]): Promise<ListingResponse> {
  if (!rawAssetDataArray || rawAssetDataArray.length === 0) {
    return {
      count: 0,
      listings: []
    };
  }
  const listingMetadataPromises /*: Promise<ListingMetadata>[] */ = rawAssetDataArray.map(
    async (rawAssetData /*: RawAssetData */) => {
      const listingMetadata = await rawAssetDataToListingMetadata(rawAssetData);
      return listingMetadata;
    }
  );

  const listingMetadataPromiseResults = await Promise.allSettled(listingMetadataPromises);
  const listingMetadataArray /*: ListingMetadata[] */ =
    getFulfilledPromiseSettledResults(listingMetadataPromiseResults);

  const assetListings = listingMetadataArray.reduce((assetListings, listingMetadata) => {
    const tokenAddress = listingMetadata.asset.address.toLowerCase();
    const tokenId = listingMetadata.asset.id;
    const docId = firestore.getDocId({ tokenId, tokenAddress, basePrice: '' });
    try {
      const assetListing = JSON.parse(getAssetAsListing(docId, { id: docId, metadata: listingMetadata })); /* as {
              count: number;
              listings: ListingMetadata & { id: string };
          }; */
      return [...assetListings, assetListing];
    } catch {
      return assetListings;
    }
  }, []);

  // async store in db
  saveRawOpenseaAssetBatchInDatabase(assetListings);

  const listings /*: Listing[] */ = listingMetadataArray.reduce((listings, listingMetadata) => {
    const rawSellOrders: RawSellOrder[] = listingMetadata.asset.rawData?.sell_orders;
    const tokenAddress = listingMetadata.asset.address.toLowerCase();
    const tokenId = listingMetadata.asset.id;
    const id = firestore.getDocId({ tokenId, tokenAddress, basePrice: '' });

    const infinityOrderData = getInfinityOrderData(listingMetadata.asset, listingMetadata.hasBlueCheck);
    if (rawSellOrders?.length > 0) {
      const infinityListingsWithOrders /*: ListingWithOrder[] */ = rawSellOrders.reduce((listings, rawSellOrder) => {
        const baseOrder = rawSellOrderToBaseOrder(rawSellOrder);
        if (baseOrder) {
          const infinityListing /*: ListingWithOrder */ = {
            id,
            metadata: listingMetadata,
            order: baseOrder,
            ...baseOrder,
            ...infinityOrderData
          };
          return [...listings, infinityListing];
        }
        return listings;
      }, []);

      return [...listings, ...infinityListingsWithOrders];
    } else {
      const listing /*: ListingWithoutOrder */ = {
        metadata: listingMetadata,
        id,
        ...infinityOrderData
      };
      return [...listings, listing];
    }
  }, []);

  return {
    count: listings?.length || 0,
    listings: listings || []
  };
}

/**
 *
 * @param asset metadata to set in the order.metadata.asset
 * @returns
 */
function rawSellOrderToBaseOrder(order: RawSellOrder): BaseOrder {
  try {
    const baseOrder = {
      howToCall: Number(order.how_to_call),
      salt: order.salt,
      feeRecipient: order.fee_recipient.address,
      staticExtradata: order.static_extradata,
      quantity: order.quantity,
      staticTarget: order.static_target,
      maker: order.maker.address,
      side: Number(order.side),
      takerProtocolFee: order.taker_protocol_fee,
      saleKind: Number(order.sale_kind),
      basePrice: order.base_price,
      extra: order.extra,
      expirationTime: order.expiration_time?.toString?.(),
      calldata: order.calldata,
      hash: order.order_hash,
      r: order.r,
      replacementPattern: order.replacement_pattern,
      taker: order.taker.address,
      takerRelayerFee: order.taker_relayer_fee,
      s: order.s,
      makerRelayerFee: order.maker_relayer_fee,
      listingTime: order.listing_time?.toString?.(),
      target: order.target,
      v: Number(order.v),
      makerProtocolFee: order.maker_protocol_fee,
      paymentToken: order.payment_token,
      feeMethod: Number(order.fee_method),
      exchange: order.exchange,
      makerReferrerFee: order.maker_referrer_fee
    };
    return baseOrder;
  } catch {}
}

function getInfinityOrderData(asset: Asset, hasBlueCheck: boolean) {
  const chainId = '1';
  const infinityOrder: InfinityOrderData = {
    source: 1, // opensea
    tokenId: asset.id,
    tokenAddress: asset.address,
    hasBlueCheck: hasBlueCheck,
    title: asset.title,
    chainId,
    hasBonusReward: false
  };
  return infinityOrder;
}

async function rawAssetDataToListingMetadata(data: RawAssetData): Promise<ListingMetadata> {
  const assetContract = data.asset_contract;
  let tokenAddress = '';
  let schema = '';
  let description = data.description;
  let collectionName = '';
  if (assetContract) {
    tokenAddress = assetContract.address;
    schema = assetContract.schema_name;
    collectionName = assetContract.name;
    if (assetContract.description) {
      description = assetContract.description;
    }
  }
  const hasBlueCheck = await isTokenVerified(tokenAddress);
  const traits = convertRawTraitsToInfinityTraits(data.traits);
  const rawSellOrder = data.sell_orders?.[0];
  const basePriceInWei = rawSellOrder?.base_price;

  const basePriceInEth = basePriceInWei ? Number(ethers.utils.formatEther(basePriceInWei)) : undefined;
  const listingType = getOrderTypeFromRawSellOrder(rawSellOrder);

  const listing /*: ListingMetadata */ = {
    hasBonusReward: false,
    createdAt: new Date(assetContract.created_date).getTime(),
    basePriceInEth: basePriceInEth,
    listingType,
    schema,
    hasBlueCheck,
    chainId: '1', // Assuming opensea api is only used in mainnet
    chain: 'Ethereum',
    asset: {
      title: data?.name,
      traits,
      searchTitle: getSearchFriendlyString(data.name),
      traitValues: traits?.map(({ traitValue }) => traitValue),
      numTraits: traits?.length,
      rawData: data,
      collectionName,
      id: data.token_id,
      description,
      image: data.image_url,
      searchCollectionName: getSearchFriendlyString(collectionName),
      address: tokenAddress,
      imagePreview: data.image_preview_url,
      traitTypes: traits?.map(({ traitType }) => traitType)
    }
  };
  return listing;
}

async function saveRawOpenseaAssetBatchInDatabase(assetListings: any[]) {
  try {
    const batch = firestore.db.batch();

    for (const al of assetListings) {
      const listing = al.listings[0];
      const tokenAddress = listing.metadata.asset.address.toLowerCase();
      const tokenId = listing.metadata.asset.id;
      const chainId = listing.metadata.chainId;

      const newDoc = firestore
        .collection(fstrCnstnts.ROOT_COLL)
        .doc(fstrCnstnts.INFO_DOC)
        .collection(fstrCnstnts.ASSETS_COLL)
        .doc(firestore.getAssetDocId({ tokenAddress, tokenId, chainId }));

      batch.set(newDoc, listing, { merge: true });
    }

    // commit batch
    batch.commit().catch((err) => {
      error('Error occured while batch saving asset data in database');
      error(err);
    });
  } catch (err) {
    error('Error occured while batch saving asset data in database');
    error(err);
  }
}

function convertRawTraitsToInfinityTraits(traits: RawTrait[]): Trait[] {
  // eslint-disable-next-line camelcase
  return traits?.map(({ trait_type, value }) => {
    return {
      traitType: trait_type,
      traitValue: value
    };
  });
}

export default router;
