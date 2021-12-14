import { firestore } from '@base/container';
import {
  Asset,
  BaseOrder,
  InfinityOrderData,
  Listing,
  ListingMetadata,
  ListingResponse,
  ListingWithOrder,
  ListingWithoutOrder,
  Trait
} from '@base/types/ListingResponse';
import { RawAssetData, RawSellOrder, RawTrait } from '@base/types/OSNftInterface';
import { OrderDirection } from '@base/types/Queries';
import { fstrCnstnts, OPENSEA_API } from '@constants';
import { isTokenVerified } from '@services/infinity/collections/isTokenVerified';
import { getAssetAsListing } from '@services/infinity/utils';
import { getSearchFriendlyString } from '@utils/formatters';
import { error, log } from '@utils/logger';
import { getFulfilledPromiseSettledResults } from '@utils/promises';
import { AxiosResponse } from 'axios';
import { ethers } from 'ethers';
import { getOrderTypeFromRawSellOrder, openseaClient } from '../utils';

export async function getAssetsFromOpenSeaByUser(userAddress: string, offset: number, limit: number) {
  log('Fetching assets from opensea');
  const url = OPENSEA_API + 'assets/';

  const options = {
    params: {
      limit,
      offset,
      owner: userAddress
    }
  };

  try {
    const { data } = await openseaClient.get(url, options);
    return data;
  } catch (err) {
    error('Error occured while fetching assets from opensea');
    error(err);
  }
}

/**
 *
 * @param owner The address of the owner of the assets
 * @param tokenIds An array of token IDs to search for
 * @param assetContractAddress The NFT contract address for the assets
 * @param assetContractAddresses An array of contract addresses to search for
 * @param orderBy How to order the assets returned (sale_date, sale_count, sale_price) defaults to sale_price
 * @param orderDirection asc or desc
 * @param offset
 * @param limit
 * @param collection Limit responses to members of a collection. Case sensitive and must match the collection slug exactly
 */
export async function getAssetsFromOpensea(
  owner?: string,
  tokenIds?: string[],
  assetContractAddress?: string,
  assetContractAddresses?: string[],
  orderBy?: 'sale_date' | 'sale_count' | 'sale_price',
  orderDirection?: OrderDirection,
  offset?: number,
  limit?: number,
  collection?: string
) {
  log('Fetching assets from opensea');

  const ownerQuery = owner ? { owner } : {};

  const tokenIdsQuery = (tokenIds ?? []).length > 0 ? { token_ids: tokenIds } : {};
  const assetContractAddressQuery = assetContractAddress ? { asset_contract_address: assetContractAddress } : {};
  const assetContractAddressesQuery =
    (assetContractAddresses ?? []).length > 0 ? { asset_contract_addresses: assetContractAddresses } : {};

  const isValidOrderByOption = ['sale_date', 'sale_count', 'sale_price'].includes(orderBy ?? '');
  const defaultOrderBy = 'sale_date';
  if (orderBy && !isValidOrderByOption) {
    error(`Invalid order by option passed while fetching assets from opensea`);
    orderBy = defaultOrderBy;
  }
  const orderByQuery = orderBy ? { order_by: orderBy } : { order_by: defaultOrderBy };

  const isValidOrderDirection = [OrderDirection.Ascending, OrderDirection.Descending].includes(
    orderDirection as OrderDirection
  );
  const defaultOrderDirection = OrderDirection.Descending;
  if (orderDirection && !isValidOrderDirection) {
    error(`Invalid order direction option passed while fetching assets from opensea`);
    orderDirection = defaultOrderDirection;
  }

  const orderDirectionQuery = orderDirection
    ? { order_direction: orderDirection }
    : { order_direction: defaultOrderDirection };

  const offsetQuery = offset ? { offset } : { offset: 0 };
  // limit is capped at 50
  const limitQuery = limit && limit <= 50 ? { limit } : { limit: 50 };
  const collectionQuery = collection ? { collection } : {};

  const url = OPENSEA_API + 'assets/';
  try {
    const { data }: AxiosResponse<{ assets: RawAssetData[] }> = await openseaClient.get(url, {
      params: {
        ...ownerQuery,
        ...tokenIdsQuery,
        ...assetContractAddressQuery,
        ...assetContractAddressesQuery,
        ...orderByQuery,
        ...orderDirectionQuery,
        ...offsetQuery,
        ...limitQuery,
        ...collectionQuery
      }
    });
    const listings = await convertOpenseaListingsToInfinityListings(data.assets);

    return listings;
  } catch (error) {
    error('Error occured while fetching assets from opensea');
    error(error);
  }
}

/**
 *  converts listings
 *
 * @param rawAssetDataArray to be converted to infinity listings
 * @returns an array of listings following the infinity schema
 */
export async function convertOpenseaListingsToInfinityListings(
  rawAssetDataArray: RawAssetData[]
): Promise<ListingResponse> {
  if (!rawAssetDataArray || rawAssetDataArray.length === 0) {
    return {
      count: 0,
      listings: []
    };
  }
  const listingMetadataPromises: Array<Promise<ListingMetadata>> = rawAssetDataArray.map(
    async (rawAssetData: RawAssetData) => {
      const listingMetadata = await rawAssetDataToListingMetadata(rawAssetData);
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
    const rawSellOrders: RawSellOrder[] = listingMetadata.asset.rawData?.sell_orders;
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
export function rawSellOrderToBaseOrder(order: RawSellOrder): BaseOrder | undefined {
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

export async function rawAssetDataToListingMetadata(data: RawAssetData): Promise<ListingMetadata> {
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

export function convertRawTraitsToInfinityTraits(traits: RawTrait[]): Trait[] {
  // eslint-disable-next-line camelcase
  return traits?.map(({ trait_type, value }) => {
    return {
      traitType: trait_type,
      traitValue: value
    };
  });
}

export async function saveRawOpenseaAssetInDatabase(chainId: string, rawAssetData: RawAssetData) {
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
    await newDoc.set(assetData);
    return getAssetAsListing(newDoc.id, assetData);
  } catch (err) {
    error('Error occured while saving asset data in database');
    error(err);
  }
}

export async function openseaAssetDataToListing(chainId: string, data: RawAssetData) {
  const assetContract = data.asset_contract;
  let tokenAddress = '';
  let schema = '';
  let description = data.description;
  let collectionName = '';
  let numTraits = 0;
  const traits = [];
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
