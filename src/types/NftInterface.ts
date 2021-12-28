import { InfinityTweet, InfinityTwitterAccount } from '@services/twitter/Twitter';
import { WyvernTraitWithValues } from './wyvern/WyvernOrder';

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
  traits: WyvernTraitWithValues[];
  hasBlueCheck: boolean;
  address: string;
  name: string;
  cardImage: string;
  openseaUrl: string;
  chainId: '1' | string;
  /**
   * link to the collections twitter
   */
  twitter?: string;
  twitterSnippet?: TwitterSnippet;
}

export interface TwitterSnippet {
  /**
   * time the twitter snippet was last updated
   * UTC epoch
   */
  timestamp: number;

  /**
   * the collection's twitter account
   */
  account?: InfinityTwitterAccount;

  /**
   * recent tweets by verified users mentioning the collection
   */
  recentTweets?: InfinityTweet[];

  /**
   * twitter users with the most followers that have mentioned the collection
   */
  topMentions?: InfinityTwitterAccount[];
}
