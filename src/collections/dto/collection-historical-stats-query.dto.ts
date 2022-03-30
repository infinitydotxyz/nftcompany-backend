import { OrderDirection } from '@infinityxyz/lib/types/core';
import { StatsPeriod } from '@infinityxyz/lib/types/core/StatsPeriod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { parseIntTransformer } from 'common/transformers/parse-int.transformer';

export class CollectionHistoricalStatsQueryDto {
  @ApiProperty({
    description: 'Period to get stats for',
    enum: StatsPeriod
  })
  @IsEnum(StatsPeriod)
  period: StatsPeriod;

  @ApiProperty({
    description:
      'Direction to order stats by. Stats are ordered by timestamp. Descending returns the most recent stats first',
    enum: OrderDirection
  })
  @IsEnum(OrderDirection)
  orderDirection: OrderDirection;

  @ApiProperty({
    description: 'Number of data points to get. Max of 20'
  })
  @IsNumber()
  @Transform(parseIntTransformer({ max: 20 }))
  limit: number;

  @ApiPropertyOptional({
    description: 'Cursor to start after'
  })
  @IsString()
  @IsOptional()
  cursor?: string;

  @ApiProperty({
    description: 'Minimum timestamp to get stats of (inclusive). Epoch timestamp (ms)'
  })
  @IsNumber()
  @Transform(parseIntTransformer())
  minDate: number;

  @ApiProperty({
    description: 'Maximum timestamp to get stats of (inclusive). Epoch timestamp (ms)'
  })
  @IsNumber()
  @Transform(parseIntTransformer())
  maxDate: number;
}
