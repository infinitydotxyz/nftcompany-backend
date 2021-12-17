import { Order } from './Order';
/**
 * @typedef { import("./Order").Order} Order
 */

/**
 * @typedef {Object} InfinityOrderData
 * @property {string} title
 * @property {string} tokenAddress
 * @property {string} tokenId
 * @property {number} [source]
 * @property {string} [name]
 * @property {string} [description]
 * @property {string} [image]
 * @property {string} [cardImage]
 * @property {string} [imagePreview]
 * @property {number} [price]
 * @property {number} [inStock]
 * @property {Order} [order]
 * @property {string} [collectionName]
 * @property {string} [maker]
 * @property {boolean} [hasBonusReward]
 * @property {boolean} [hasBlueCheck]
 * @property {string} [owner]
 * @property {string} [schemaName]
 * @property {string} [expirationTime]
 * @property {string} [chainId]
 */
export interface InfinityOrderData {
  title: string;
  tokenAddress: string;
  tokenId: string;
  source?: number;
  name?: string;
  description?: string;
  image?: string;
  cardImage?: string;
  imagePreview?: string;
  price?: number;
  inStock?: number;
  order?: Order;
  collectionName?: string;
  maker?: string;
  hasBonusReward?: boolean;
  hasBlueCheck?: boolean;
  owner?: string;
  schemaName?: string;
  expirationTime?: string;
  chainId?: string;
}
