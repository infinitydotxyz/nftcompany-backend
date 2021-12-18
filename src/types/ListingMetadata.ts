/**
 * @typedef { import("./Asset").Asset} Asset
 */

import { Asset } from './Asset';

/**
 * @typedef {Object} ListingMetadata
 * @property {boolean} hasBonusReward
 * @property {string} schema
 * @property {number} createdAt
 * @property {string} chainId
 * @property {string} chain
 * @property {Asset} asset
 * @property {boolean} hasBlueCheck
 * @property {number} [basePriceInEth]
 * @property {string} [listingType]
 */

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
