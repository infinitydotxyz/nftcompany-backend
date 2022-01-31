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
  isClaimed?: boolean;

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

  benefits?: string[];

  partnerships?: Array<{ name: string; link: string }>;

  twitterSnippet?: TwitterSnippet;

  discordSnippet?: DiscordSnippet;
}

export type CollectionData = CollectionInfo & { links?: Links; stats?: CollectionStats };

export type EditableCollectionData = Pick<
  CollectionData,
  'profileImage' | 'name' | 'description' | 'benefits' | 'partnerships' | 'links'
>;

export interface UpdateCollectionDataRequest {
  profileImage: {
    /**
     * file is passed through req.files.profileImage
     */
    /**
     * whether the image was deleted
     */
    isDeleted: boolean;
  };
  name: string;
  description: string;
  twitter: string;
  discord: string;
  instagram: string;
  facebook: string;
  external: string;
  medium: string;
  wiki: string;
  telegram: string;
  benefits: string[];
  partnerships: Array<{ name: string; link: string }>;
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
    discordMembers?: number;
    discordPresence?: number;
    twitterFollowers?: number;
  };
  sevenDay: {
    volume: number;
    change: number;
    sales: number;
    averagePrice: number;
    discordMembers?: number;
    discordPresence?: number;
    twitterFollowers?: number;
  };
  thirtyDay: {
    volume: number;
    change: number;
    sales: number;
    averagePrice: number;
    discordMembers?: number;
    discordPresence?: number;
    twitterFollowers?: number;
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
  collectionAddress?: string;
  discordMembers?: number;
  discordPresence?: number;
  twitterFollowers?: number;
  votesFor?: number;
  votesAgainst?: number;
  name?: string;
  profileImage?: string;
  searchCollectionName?: string;
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
  facebook?: string;
}
