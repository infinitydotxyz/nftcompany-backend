import { Listing, ListingResponse } from '@base/types/ListingResponse';
import { OrderSide } from '@base/types/NftInterface';
import { OrderDirection } from '@base/types/Queries';
import { deepCopy } from '@utils/index';
import { error, log } from '@utils/logger';
import { convertOpenseaListingsToInfinityListings } from './assets/getAssetsFromOpensea';
import { openseaClient } from './utils';

export async function getRawOpenseaOrdersByTokenAddress(
  tokenAddress: string,
  limit: number,
  offset: number | string,
  tokenId?: string
) {
  const url = 'https://api.opensea.io/wyvern/v1/orders';
  const options: any = {
    params: {
      side: 0,
      asset_contract_address: tokenAddress,
      limit,
      offset
    }
  };

  if (tokenId) {
    options.params.token_id = tokenId;
  }

  const { data } = await openseaClient.get(url, options);
  return data;
}

export async function getOpenseaOrders({
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
  saleKind?: number;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: OrderDirection;
}): Promise<{ success: boolean; data?: { count: number; orders: Listing[] }; error?: Error }> {
  log('Fetching Orders from OpenSea');
  const url = 'https://api.opensea.io/wyvern/v1/orders/';
  const options = {
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
    }
  };

  try {
    const { data } = await openseaClient.get(url, options);
    if (data.orders && data.orders.length === 0) {
      const x: { success: boolean; data: { count: number; orders: Listing[] } } = {
        success: true,
        data: {
          count: 0,
          orders: []
        }
      };
      return x;
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

    const listingsResponse: ListingResponse = await convertOpenseaListingsToInfinityListings(openseaListings.listings);

    const aggregateListingAsOrders = (listings: Listing[]) => {
      return listings?.reduce?.(
        (acc: { count: number; orders: Listing[] }, listing: Listing) => {
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

    return { success: true, data: result };
  } catch (err) {
    error('Error occured while fetching orders from opensea');
    error(err);
    return { success: false, error: err };
  }
}
