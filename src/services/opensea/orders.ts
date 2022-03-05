import { Listing } from 'infinity-types/types/Listing';
import { ListingResponse } from 'infinity-types/types/ListingResponse';
import { OrderSide } from 'infinity-types/types/NftInterface';
import { OrderDirection } from 'infinity-types/types/Queries';
import { WyvernAssetData, WyvernSellOrder } from 'infinity-types/types/wyvern/WyvernOrder';
import { deepCopy } from '@utils/index';
import { error, log } from '@utils/logger';
import { AxiosResponse } from 'axios';
import { convertOpenseaListingsToInfinityListings, openseaClient } from './utils';

type OpenseaOrder = WyvernSellOrder & { asset: WyvernAssetData };

interface OpenseaOrderResponse {
  count: number;
  orders: OpenseaOrder[];
}

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
    /**
     * sometimes token_id fails with a response of
     * "You need to set asset_contract_address and token_id (or token_ids)"
     *
     * using token_ids seems to work all of the time
     */
    options.params.token_ids = tokenId;
  }

  const { data }: AxiosResponse<OpenseaOrderResponse> = await openseaClient.get(url, options);
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
}): Promise<{ count: number; orders: Listing[] } | undefined> {
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
    const { data }: AxiosResponse<OpenseaOrderResponse> = await openseaClient.get(url, options);
    if (data?.orders?.length === 0) {
      return {
        count: 0,
        orders: []
      };
    }

    // reduce to one asset per contract/tokenId with a list of openseaListings
    const assetIdToListingIndex: Record<string, number> = {};

    const convertOpenseaOrdersToOpenseaListings = (orders: OpenseaOrder[]) => {
      const getOrderData = (listing: OpenseaOrder) => {
        const listingCopy = deepCopy(listing);
        delete listingCopy.asset;
        return listingCopy;
      };
      return orders.reduce(
        (
          acc: { count: number; listings: Array<WyvernAssetData & { sell_orders: WyvernSellOrder[] }> },
          item: OpenseaOrder
        ) => {
          if (item.asset) {
            const id: string = typeof item.asset.id === 'number' ? `${item.asset.id}` : '';
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

    const listingsResponse: ListingResponse = await convertOpenseaListingsToInfinityListings(
      openseaListings.listings,
      true
    );

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

    return result;
  } catch (err) {
    error('Error occurred while fetching orders from opensea');
    error(err);
  }
}
