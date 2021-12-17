import { Asset } from './Asset';
import { InfinityOrderData } from './InfinityOrderData';
import { Order } from './Order';

/**
 * @typedef { import("./Asset").Asset} Asset
 */
/**
 * @typedef { import("./InfinityOrderData").InfinityOrderData} InfinityOrderData
 */
/**
 * @typedef { import("./Order").Order} Order
 */

/**
 * @typedef {ListingWithOrder | ListingWithoutOrder} Listing;
 */
export type Listing = ListingWithOrder | ListingWithoutOrder;

/**
 * @typedef {Order & ListingWithoutOrder} ListingWithOrder
 */
export type ListingWithOrder = Order & ListingWithoutOrder;

/**
 * @typedef {Object} ListingWithoutOrder
 * @extends InfinityOrderData
 * @property {string} id
 * @property {ListingMetadata} metadata
 * @property {*} [rawData]
 */
export interface ListingWithoutOrder extends InfinityOrderData {
  id: string;
  metadata: ListingMetadata;
  rawData?: any;
}

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
