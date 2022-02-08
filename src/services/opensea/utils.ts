import { firestore } from '@base/container';
import { Asset } from '@base/types/Asset';
import { InfinityOrderData } from '@base/types/InfinityOrderData';
import { Listing, ListingWithOrder, ListingWithoutOrder } from '@base/types/Listing';
import { ListingMetadata } from '@base/types/ListingMetadata';
import { ListingResponse } from '@base/types/ListingResponse';

import { ListingType } from '@base/types/NftInterface';
import { Order } from '@base/types/Order';
import { Trait } from '@base/types/Trait';
import { WyvernAssetData, WyvernSellOrder, WyvernTrait } from '@base/types/wyvern/WyvernOrder';
import { fstrCnstnts, OPENSEA_API_KEY } from '@base/constants';
import { isTokenVerified } from '@services/infinity/collections/isTokenVerified';
import { getAssetAsListing } from '@services/infinity/utils';
import { getSearchFriendlyString, openseaParamSerializer } from '@utils/formatters';
import { error } from '@utils/logger';
import { getFulfilledPromiseSettledResults } from '@utils/promises';
import axios from 'axios';
import { ethers } from 'ethers';

export const openseaClient = axios.create({
  headers: {
    'X-AUTH-KEY': OPENSEA_API_KEY ?? '',
    'X-API-KEY': OPENSEA_API_KEY ?? ''
  },
  paramsSerializer: openseaParamSerializer
});

export function getOrderTypeFromRawSellOrder(order: WyvernSellOrder) {
  switch (order?.sale_kind) {
    case 0:
      if (order?.payment_token_contract?.symbol === 'ETH') {
        return ListingType.FixedPrice;
      }
      return ListingType.EnglishAuction;
    case 1:
      return ListingType.DutchAuction;
    default:
  }
}

/**
 *  converts listings
 *
 * @param rawAssetDataArray to be converted to infinity listings
 * @returns an array of listings following the infinity schema
 */
export async function convertOpenseaListingsToInfinityListings(
  rawAssetDataArray: WyvernAssetData[], areListings: boolean
): Promise<ListingResponse> {
  if (!rawAssetDataArray || rawAssetDataArray.length === 0) {
    return {
      count: 0,
      listings: []
    };
  }
  const listingMetadataPromises: Array<Promise<ListingMetadata>> = rawAssetDataArray.map(
    async (rawAssetData: WyvernAssetData) => {
      const listingMetadata = await rawAssetDataToListingMetadata(rawAssetData, areListings);
      return listingMetadata;
    }
  );

  const listingMetadataPromiseResults = await Promise.allSettled(listingMetadataPromises);
  const listingMetadataArray: ListingMetadata[] = getFulfilledPromiseSettledResults(listingMetadataPromiseResults);

  const assetListings = listingMetadataArray.reduce((assetListings, listingMetadata) => {
    const tokenAddress = listingMetadata.asset.address.toLowerCase();
    const tokenId = listingMetadata.asset.id;
    const docId = firestore.getDocId({
      tokenId,
      tokenAddress,
      basePrice: listingMetadata.basePriceInEth?.toString?.() ?? ''
    });
    try {
      const assetListing = getAssetAsListing(docId, { id: docId, metadata: listingMetadata });
      return [...assetListings, assetListing];
    } catch {
      return assetListings;
    }
  }, []);

  // async store in db
  void saveRawOpenseaAssetBatchInDatabase(assetListings);

  const listings: Listing[] = listingMetadataArray.reduce((listings, listingMetadata) => {
    const rawSellOrders: WyvernSellOrder[] = listingMetadata.asset.rawData?.sell_orders;
    const tokenAddress = listingMetadata.asset.address.toLowerCase();
    const tokenId = listingMetadata.asset.id;
    const id = firestore.getDocId({
      tokenId,
      tokenAddress,
      basePrice: listingMetadata.basePriceInEth?.toString?.() ?? ''
    });

    const infinityOrderData = getInfinityOrderData(listingMetadata.asset, listingMetadata.hasBlueCheck);
    if (rawSellOrders?.length > 0) {
      const infinityListingsWithOrders: ListingWithOrder[] = rawSellOrders.reduce((listings, rawSellOrder) => {
        const baseOrder = rawSellOrderToBaseOrder(rawSellOrder);
        if (baseOrder) {
          const infinityListing: ListingWithOrder = {
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
      const listing: ListingWithoutOrder = {
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
export function rawSellOrderToBaseOrder(order: WyvernSellOrder): Order | undefined {
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

export function getInfinityOrderData(asset: Asset, hasBlueCheck: boolean) {
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

export async function saveRawOpenseaAssetBatchInDatabase(assetListings: any[]) {
  try {
    const batch = firestore.db.batch();

    for (const al of assetListings) {
      const listing = al.listings[0];
      const tokenAddress = listing.metadata.asset.address.toLowerCase();
      const tokenId = listing.metadata.asset.id;
      const chainId = listing.metadata.chainId;

      for (const key of Object.keys(listing.metadata.asset)) {
        if (!listing.metadata.asset[key]) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete listing.metadata.asset[key];
        }
      }

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

export async function rawAssetDataToListingMetadata(data: WyvernAssetData, isListing: boolean): Promise<ListingMetadata> {
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

  const basePriceInEthObj = basePriceInWei ? { basePriceInEth: Number(ethers.utils.formatEther(basePriceInWei)) } : {};
  const listingType = getOrderTypeFromRawSellOrder(rawSellOrder);
  const listingTypeObj = listingType ? { listingType } : {};

  const listing: ListingMetadata = {
    hasBonusReward: false,
    isListing,
    createdAt: new Date(assetContract.created_date).getTime(),
    ...basePriceInEthObj,
    ...listingTypeObj,
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

export function convertRawTraitsToInfinityTraits(traits: WyvernTrait[]): Trait[] {
  // eslint-disable-next-line camelcase
  return traits?.map(({ trait_type, value }) => {
    return {
      traitType: trait_type,
      traitValue: value
    };
  });
}

export async function saveRawOpenseaAssetInDatabase(chainId: string, rawAssetData: WyvernAssetData) {
  try {
    const assetData: any = {};
    const marshalledData = await openseaAssetDataToListing(chainId, rawAssetData);
    assetData.metadata = marshalledData;
    assetData.rawData = rawAssetData;

    const tokenAddress = marshalledData.asset.address.toLowerCase();
    const tokenId = marshalledData.asset.id;
    const newDoc = firestore
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.ASSETS_COLL)
      .doc(firestore.getAssetDocId({ tokenAddress, tokenId, chainId }));
    newDoc.set(assetData).catch((err) => {
      error('Error saving asset in firestore');
      error(err);
    });
    return getAssetAsListing(newDoc.id, assetData);
  } catch (err) {
    error('Error occured while saving asset data in database');
    error(err);
  }
}

export async function openseaAssetDataToListing(chainId: string, data: WyvernAssetData) {
  const assetContract = data.asset_contract;
  let tokenAddress = '';
  let schema = '';
  let description = data.description;
  let collectionName = '';
  let numTraits = 0;
  const traits: any[] = [];
  if (data.traits && data.traits.length > 0) {
    for (const attr of data.traits) {
      numTraits++;
      traits.push({ traitType: attr.trait_type, traitValue: String(attr.value) });
    }
  }
  if (assetContract) {
    tokenAddress = assetContract.address;
    schema = assetContract.schema_name;
    collectionName = assetContract.name;
    if (assetContract.description) {
      description = assetContract.description;
    }
  }
  const hasBlueCheck = await isTokenVerified(tokenAddress);
  const listing = {
    isListing: false,
    hasBlueCheck,
    schema,
    chainId,
    asset: {
      address: tokenAddress,
      id: data.token_id,
      collectionName,
      description,
      owner: data.owner.address,
      image: data.image_url,
      imagePreview: data.image_preview_url,
      searchCollectionName: getSearchFriendlyString(collectionName),
      searchTitle: getSearchFriendlyString(data.name),
      title: data.name,
      numTraits,
      traits
    }
  };
  return listing;
}
