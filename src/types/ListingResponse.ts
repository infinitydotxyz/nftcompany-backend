/**
 * putting these here for whoever converts the server to TypeScript to use
 */
import { RawAssetData } from './OSNftInterface.js';

export interface ListingResponse {
  count: number;
  listings: Listing[];
}

export type Listing = ListingWithOrder | ListingWithoutOrder;

export type ListingWithOrder = BaseOrder & ListingWithoutOrder;

export interface ListingWithoutOrder extends InfinityOrderData {
  id: string;
  metadata: ListingMetadata;
}

export interface InfinityOrderData {
  title: string;
  tokenAddress: string;
  tokenId: string;
  /**
   * 1 if from opensea
   */
  source?: number;
  name?: string;
  description?: string;
  image?: string;
  cardImage?: string;
  imagePreview?: string;
  price?: number;
  inStock?: number;
  order?: BaseOrder;
  collectionName?: string;
  maker?: string;
  hasBonusReward?: boolean;
  hasBlueCheck?: boolean;
  owner?: string;
  schemaName?: string;
  expirationTime?: string;
  chainId?: string;
}

export interface BaseOrder {
  listingTime: string;
  v: number;
  extra: string;
  takerRelayerFee: string;
  feeRecipient: string;
  takerProtocolFee: string;
  staticTarget: string;
  side: number;
  basePrice: string;
  salt: string;
  r: string;
  howToCall: number;
  exchange: string;
  s: string;
  feeMethod: number;
  expirationTime: string;
  replacementPattern: string;
  saleKind: number;
  quantity: string;
  maker: string;
  makerProtocolFee: string;
  calldata: string;
  makerReferrerFee: string;
  taker: string;
  target: string;
  hash: string;
  makerRelayerFee: string;
  staticExtradata: string;
  paymentToken: string;
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

export interface Asset {
  title: string;
  traits: Trait[];
  searchTitle: string;
  traitValues: string[];
  numTraits: number;
  rawData: RawAssetData;
  collectionName: string;
  id: string;
  description: string;
  image: string;
  searchCollectionName: string;
  address: string;
  imagePreview: string;
  traitTypes: string[];
}

export interface Trait {
  traitType: string;
  traitValue: string;
}
