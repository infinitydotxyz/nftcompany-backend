import { OpenSeaAsset } from './OpenSeaAsset';

export interface ListingMetadata {
  hasBonusReward: boolean;
  schema: string;
  createdAt: number;
  chainId: string;
  chain: string;
  asset: OpenSeaAsset;
  hasBlueCheck: boolean;
  basePriceInEth?: number;
  listingType?: string;
  isListing: boolean;
}
