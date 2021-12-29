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

  discordSnippet?: DiscordSnippet;
}

export interface TwitterSnippet {
  /**
   * time the twitter snippet was last updated
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

export interface DiscordSnippet {
  /**
   * time the discord snippet was last updated
   */
  timestamp: number;

  /**
   * number of members in the discord
   */
  membersCount: number;

  /**
   * presence (number of active members)
   */
  presenceCount: number;
}

export interface CollectionStats {
  oneDay: {
    volume: number;
    change: number;
    sales: number;
    averagePrice: number;
  };
  sevenDay: {
    volume: number;
    change: number;
    sales: number;
    averagePrice: number;
  };
  thrityDay: {
    volume: number;
    change: number;
    sales: number;
    averagePrice: number;
  };
  total: {
    volume: number;
    sales: number;
    supply: number;
  };
  count: number;
  owners: number;
  averagePrice: number;
  reports: number;
  marketCap: number;
  floorPrice: number;
  timestamp: number;
}

export interface Links {
  timestamp: number;
  twitter?: string;
  discord?: string;
  external?: string;
  medium?: string;
  slug?: string;
  telegram?: string;
  instagram?: string;
  wiki?: string;
}
