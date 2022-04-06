import { StatsPeriod } from '@infinityxyz/lib/types/core';

export enum StatType {
  FloorPrice = 'floorPrice',
  FloorPriceChange = 'floorPricePercentChange',

  CeilPrice = 'ceilPrice',
  CeilPriceChange = 'ceilPricePercentChange',

  Volume = 'volume',
  VolumeChange = 'volumePercentChange',

  Sales = 'numSales',
  SalesChange = 'numSalesPercentChange',

  AveragePrice = 'avgPrice',
  AveragePriceChange = 'avgPricePercentChange',

  DiscordFollowers = 'discordFollowers',
  DiscordFollowersPercentChange = 'discordFollowersPercentChange',

  DiscordPresence = 'discordPresence',
  DiscordPresencePercentChange = 'discordFollowersPercentChange',

  TwitterFollowers = 'twitterFollowers',
  TwitterFollowersPercentChange = 'twitterFollowersPercentChange'
}

export interface PreAggregatedSocialsStats {
  chainId: string;
  collectionAddress: string;

  discordFollowers: number;
  discordPresence: number;
  guildId: string;
  discordLink: string;

  twitterFollowers: number;
  twitterFollowing: number;
  twitterId: string;
  twitterHandle: string;
  twitterLink: string;

  updatedAt: number;
}

export interface SocialsStats extends PreAggregatedSocialsStats {
  prevDiscordFollowers: number;
  discordFollowersPercentChange: number;

  prevDiscordPresence: number;
  discordPresencePercentChange: number;

  prevTwitterFollowers: number;
  twitterFollowersPercentChange: number;

  prevTwitterFollowing: number;
  twitterFollowingPercentChange: number;

  timestamp: number;
  period: StatsPeriod;
}
