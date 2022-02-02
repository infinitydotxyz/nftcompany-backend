import { Asset } from './Asset';

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
  isListing: boolean;
}
