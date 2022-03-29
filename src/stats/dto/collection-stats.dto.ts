import { ChainId, Stats, StatsPeriod } from '@infinityxyz/lib/types/core';
import { ApiProperty } from '@nestjs/swagger';
import { SocialsStats } from 'stats/stats.types';

export class CollectionStatsDto implements SocialsStats, Stats {
  @ApiProperty({ description: 'Chain id' })
  chainId: ChainId;

  @ApiProperty({ description: 'Corresponding collection address' })
  collectionAddress: string;

  @ApiProperty({ description: 'Floor price' })
  floorPrice: number;

  @ApiProperty({ description: 'Floor price for the previous period' })
  prevFloorPrice: number;

  @ApiProperty({ description: 'Percent change between the previous period and this period' })
  floorPricePercentChange: number;

  @ApiProperty({ description: 'Ceiling price' })
  ceilPrice: number;

  @ApiProperty({ description: 'Ceiling price in the previous period' })
  prevCeilPrice: number;

  @ApiProperty({ description: 'Percent change between the previous period and this period' })
  ceilPricePercentChange: number;

  @ApiProperty({ description: 'Volume' })
  volume: number;

  @ApiProperty({ description: 'Volume in the previous period' })
  prevVolume: number;

  @ApiProperty({ description: 'Percent change between the previous period and this period' })
  volumePercentChange: number;

  @ApiProperty({ description: 'Number of sales' })
  numSales: number;

  @ApiProperty({ description: 'Number of sales in the previous period' })
  prevNumSales: number;

  @ApiProperty({ description: 'Percent change between the previous period and this period' })
  numSalesPercentChange: number;

  @ApiProperty({ description: 'Average price' })
  avgPrice: number;

  @ApiProperty({ description: 'Average price in the previous period' })
  prevAvgPrice: number;

  @ApiProperty({ description: 'Percent change between the previous period and this period' })
  avgPricePercentChange: number;

  @ApiProperty({ description: 'Discord followers' })
  discordFollowers: number;

  @ApiProperty({ description: 'Discord followers in the previous period' })
  prevDiscordFollowers: number;

  @ApiProperty({ description: 'Percent change between the previous period and this period' })
  discordFollowersPercentChange: number;

  @ApiProperty({ description: 'Discord presence' })
  discordPresence: number;

  @ApiProperty({ description: 'Discord presence in the previous period' })
  prevDiscordPresence: number;

  @ApiProperty({ description: 'Percent change between the previous period and this period' })
  discordPresencePercentChange: number;

  @ApiProperty({ description: 'Guild id of the discord in the current period' })
  guildId: string;
  @ApiProperty({ description: 'Discord invite in the current period' })
  discordLink: string;

  @ApiProperty({ description: 'Twitter followers' })
  twitterFollowers: number;

  @ApiProperty({ description: 'Twitter followers in the previous period' })
  prevTwitterFollowers: number;

  @ApiProperty({ description: 'Percent change between the previous period and this period' })
  twitterFollowersPercentChange: number;

  @ApiProperty({ description: 'Number of accounts being followed' })
  twitterFollowing: number;

  @ApiProperty({ description: 'Number of accounts being followed in the previous period' })
  prevTwitterFollowing: number;

  @ApiProperty({ description: 'Percent change between the previous period and this period' })
  twitterFollowingPercentChange: number;

  @ApiProperty({ description: 'Twitter id of the account in the current period' })
  twitterId: string;

  @ApiProperty({ description: 'Twitter handle of the account in the current period' })
  twitterHandle: string;

  @ApiProperty({ description: 'Link to the twitter account in the current period' })
  twitterLink: string;

  @ApiProperty({ description: 'Timestamp of the current period' })
  timestamp: number;

  @ApiProperty({ description: 'Period of the current stats' })
  period: StatsPeriod;

  @ApiProperty({ description: 'Timestamp that the stats were updated at' })
  updatedAt: number;
}
