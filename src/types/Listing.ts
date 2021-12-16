import { Asset } from './Asset';
import { InfinityOrderData } from './InfinityOrderData';
import { Order } from './Order';

export type Listing = ListingWithOrder | ListingWithoutOrder;

export type ListingWithOrder = Order & ListingWithoutOrder;

export interface ListingWithoutOrder extends InfinityOrderData {
  id: string;
  metadata: ListingMetadata;
  rawData?: any;
}

export interface ListingMetadata {
  hasBonusReward: boolean;
  schema: string;
  createdAt: number;
  chainId: string;
  chain: string;
  asset: Asset;
  hasBlueCheck: boolean;
  basePriceInEth?: number;
  listingType?: string;
}
