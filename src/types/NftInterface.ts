import { WyvernTraitWithValues } from './WyvernOrder';
/**
 * @typedef { import("./WyvernOrder".WyvernTraitWithValues)} WyvernTraitWithValues
 */

export enum OrderSide {
  Buy = 0,
  Sell = 1
}

export enum ListingType {
  FixedPrice = 'fixedPrice',
  DutchAuction = 'dutchAuction',
  EnglishAuction = 'englishAuction'
}

/**
 * @typedef {Object} CollectionInfo
 * @property {string} chain
 * @property {string} searchCollectionName
 * @property {string} description
 * @property {string} bannerImage
 * @property {string} profileImage
 * @property {WyvernTraitWithValues[]} traits
 * @property {boolean} hasBlueCheck
 * @property {string} address
 * @property {string} name
 * @property {string} cardImage
 * @property {string} openseaUrl
 * @property {string} chainId
 */
export interface CollectionInfo {
  chain: 'Ethereum' | string;
  searchCollectionName: string;
  description: string;
  bannerImage: string;
  profileImage: string;
  traits: WyvernTraitWithValues[];
  hasBlueCheck: boolean;
  address: string;
  name: string;
  cardImage: string;
  openseaUrl: string;
  chainId: '1' | string;
}
