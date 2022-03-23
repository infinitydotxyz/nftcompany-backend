import { StatsPeriod } from '@infinityxyz/lib/types/core';

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
