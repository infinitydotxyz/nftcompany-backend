import { OrderDirection, StatsPeriod } from '@infinityxyz/lib/types/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { parseIntTransformer } from 'common/transformers/parse-int.transformer';

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

export default class StatsRequestDto {
  @ApiProperty({
    description: 'Period to get stats for'
  })
  @IsEnum(StatsPeriod)
  period: StatsPeriod;

  @ApiProperty({
    description: 'Specific time to get stats for. Epoch timestamp in milliseconds'
  })
  @IsNumber()
  @Transform(parseIntTransformer())
  date: number;

  @ApiProperty({
    description: 'Stat to order the results by'
  })
  @IsEnum(StatType)
  orderBy: StatType;

  @ApiProperty({
    description: 'Direction to order by'
  })
  @IsEnum(OrderDirection)
  orderDirection: OrderDirection;

  @ApiProperty({
    description: 'Number of results to get. Max of 50'
  })
  @IsNumber()
  @Transform(parseIntTransformer({ max: 50 }))
  limit: number;

  @ApiPropertyOptional({
    description: 'Cursor to start after'
  })
  @IsString()
  @IsOptional()
  cursor?: string;
}
