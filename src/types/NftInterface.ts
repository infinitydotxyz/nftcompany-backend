import { RawTraitWithValues } from './OSNftInterface';

export enum OrderSide {
  Buy = 0,
  Sell = 1
}

export enum ListingType {
  FixedPrice = 'fixedPrice',
  DutchAuction = 'dutchAuction',
  EnglishAuction = 'englishAuction'
}

export interface CollectionInfo {
  chain: 'Ethereum' | string;
  searchCollectionName: string;
  description: string;
  bannerImage: string;
  profileImage: string;
  traits: RawTraitWithValues[];
  hasBlueCheck: boolean;
  address: string;
  name: string;
  cardImage: string;
  openseaUrl: string;
  chainId: '1' | string;
}
