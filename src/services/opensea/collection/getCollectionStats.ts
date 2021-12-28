import { error } from '@utils/logger';
import { AxiosResponse } from 'axios';
import { openseaClient } from '../utils';

interface CollectionStatsResponse {
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

export async function getCollectionStats(openseaCollectionSlug: string) {
  try {
    const collectionRespone: AxiosResponse<CollectionStatsResponse> = await openseaClient.get(
      `https://api.opensea.io/api/v1/collection/${openseaCollectionSlug}/stats`
    );
    const stats = collectionRespone.data.stats;
    return {
      oneDay: {
        volume: stats.one_day_volume,
        change: stats.one_day_change,
        sales: stats.one_day_sales,
        averagePrice: stats.one_day_average_price
      },
      sevenDay: {
        volume: stats.seven_day_volume,
        change: stats.seven_day_change,
        sales: stats.seven_day_sales,
        averagePrice: stats.seven_day_average_price
      },
      thrityDay: {
        volume: stats.thirty_day_volume,
        change: stats.thirty_day_change,
        sales: stats.thirty_day_sales,
        averagePrice: stats.thirty_day_average_price
      },
      total: {
        volume: stats.total_volume,
        sales: stats.total_sales,
        supply: stats.total_supply
      },
      count: stats.count,
      owners: stats.num_owners,
      averagePrice: stats.average_price,
      reports: stats.num_reports,
      marketCap: stats.market_cap,
      floorPrice: stats.floor_price
    };
  } catch (e) {
    error('Error occurred while fetching collection stats from opensea');
    error(e);
  }
}
