import { WyvernAssetData } from '@infinityxyz/types/protocols/wyvern';
import { OrderDirection } from '@infinityxyz/types/core';
import { OPENSEA_API } from '@base/constants';
import { error, log } from '@utils/logger';
import { AxiosResponse } from 'axios';
import { convertOpenseaListingsToInfinityListings, openseaClient } from '../utils';

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
    const { data }: AxiosResponse<{ assets: WyvernAssetData[] }> = await openseaClient.get(url, {
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
    const listings = await convertOpenseaListingsToInfinityListings(data.assets, false);

    return listings;
  } catch (error) {
    error('Error occured while fetching assets from opensea');
    error(error);
  }
}
