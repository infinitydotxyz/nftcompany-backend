import { OrderDirection } from '@infinityxyz/lib/types/core';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import { parseIntTransformer } from 'common/transformers/parse-int.transformer';

export enum CollectionStat {
  AveragePrice = 'avgPrice',
  CeilPrice = 'ceilPrice',
  FloorPrice = 'floorPrice',
  Sales = 'totalNumSales',
  Volume = 'totalVolume'
}

export default class RequestCollectionsStatsDto {
  @ApiProperty({
    description: 'Period to get stats for'
  })
  @IsEnum(CollectionStatsPeriod)
  period: CollectionStatsPeriod;

  @ApiProperty({
    description: 'Specific date to get stats for'
  })
  @IsNumber()
  @Transform(parseIntTransformer())
  date: number;

  @ApiProperty({
    description: 'Collection stat to order the collection by'
  })
  @IsEnum(CollectionStat)
  orderBy: CollectionStat;

  @ApiProperty({
    description: 'Direction to order by'
  })
  @IsEnum(OrderDirection)
  orderDirection: OrderDirection;

  @ApiProperty({
    description: 'Number of results to get'
  })
  @IsNumber()
  @Transform(parseIntTransformer({ max: 50 }))
  limit: number;

  startAfter: string;
}
