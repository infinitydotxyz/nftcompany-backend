import { StatsPeriod } from '@infinityxyz/lib/types/core';

export class SocialsStats {
  discordFollowers: number;
  discordPresence: number;
  guildId: string;
  link: string;

  twitterFollowers: number;
  twitterFollowing: number;
  twitterId: number;
  twitterHandle: string;
  twitterLink: string;

  updatedAt: number;
  timestamp: number;
  period: StatsPeriod;
}
