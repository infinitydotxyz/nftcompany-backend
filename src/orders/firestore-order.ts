import { ChainOBOrder } from '@infinityxyz/lib/types/core';

export interface FirestoreOrder {
  id: string;
  orderStatus: string;
  chainId: string;
  isSellOrder: boolean;
  numItems: number;
  startPriceEth: number;
  endPriceEth: number;
  startPriceWei: string;
  endPriceWei: string;
  startTimeMs: number;
  endTimeMs: number;
  minBpsToSeller: number;
  nonce: string;
  complicationAddress: string;
  currencyAddress: string;
  makerUsername: string;
  makerAddress: string;
  takerUsername: string;
  takerAddress: string;
  signedOrder: ChainOBOrder;
}

export interface FirestoreOrderItem {
  id: string;
  orderStatus: string;
  chainId: string;
  isSellOrder: boolean;
  numItems: number;
  startPriceEth: number;
  endPriceEth: number;
  startTimeMs: number;
  endTimeMs: number;
  makerUsername: string;
  makerAddress: string;
  takerUsername: string;
  takerAddress: string;
  collection: string;
  collectionName: string;
  profileImage: string; // todo: change to more descriptive name
  tokenId: string;
  tokenName: string;
  imageUrl: string;
  numTokens: number;
}
