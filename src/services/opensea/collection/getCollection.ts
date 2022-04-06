import { error } from '@infinityxyz/lib/utils';
import { AxiosResponse } from 'axios';
import { openseaClient } from '../utils';
import { Collection } from './getContract';
interface CollectionResponse {
  collection: FullCollection;
}

interface FullCollection extends Collection {
  editors: string[];
  payment_tokens: Paymenttoken[];
  primary_asset_contracts: Primaryassetcontract[];
  traits: Record<string, { [value: string]: number }>;
  stats: Stats;
}

interface Stats {
  one_day_volume: number;
  one_day_change: number;
  one_day_sales: number;
  one_day_average_price: number;
  seven_day_volume: number;
  seven_day_change: number;
  seven_day_sales: number;
  seven_day_average_price: number;
  thirty_day_volume: number;
  thirty_day_change: number;
  thirty_day_sales: number;
  thirty_day_average_price: number;
  total_volume: number;
  total_sales: number;
  total_supply: number;
  count: number;
  num_owners: number;
  average_price: number;
  num_reports: number;
  market_cap: number;
  floor_price: number;
}
interface Primaryassetcontract {
  address: string;
  asset_contract_type: string;
  created_date: string;
  name: string;
  nft_version: string;
  opensea_version?: any;
  owner: number;
  schema_name: string;
  symbol: string;
  total_supply: string;
  description: string;
  external_link: string;
  image_url: string;
  default_to_fiat: boolean;
  dev_buyer_fee_basis_points: number;
  dev_seller_fee_basis_points: number;
  only_proxied_transfers: boolean;
  opensea_buyer_fee_basis_points: number;
  opensea_seller_fee_basis_points: number;
  buyer_fee_basis_points: number;
  seller_fee_basis_points: number;
  payout_address: string;
}

interface Paymenttoken {
  id: number;
  symbol: string;
  address: string;
  image_url: string;
  name: string;
  decimals: number;
  eth_price: number;
  usd_price: number;
}

export async function getCollectionFromOpensea(openseaCollectionSlug: string): Promise<FullCollection | undefined> {
  try {
    const collectionRespone: AxiosResponse<CollectionResponse> = await openseaClient.get(
      `https://api.opensea.io/api/v1/collection/${openseaCollectionSlug}/stats`
    );
    return collectionRespone.data.collection;
  } catch (e) {
    error('Error occurred while fetching collection from opensea');
    error(e);
  }
}
