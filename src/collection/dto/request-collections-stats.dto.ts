import { OrderDirection, StatsPeriod } from '@infinityxyz/lib/types/core';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber } from 'class-validator';
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
  AveragePriceChange = 'avgPricePercentChange'
}

export default class RequestCollectionsStatsDto {
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
    description: 'Collection stat to order the collection by'
  })
  @IsEnum(StatType)
  orderBy: StatType;

  @ApiProperty({
    description: 'Direction to order by'
  })
  @IsEnum(OrderDirection)
  orderDirection: OrderDirection;

  @ApiProperty({
    description: 'Number of results to get. Max of 50.'
  })
  @IsNumber()
  @Transform(parseIntTransformer({ max: 50 }))
  limit: number;

  startAfter: string;
}
