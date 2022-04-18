import { OrderDirection, StatsPeriod, StatType } from '@infinityxyz/lib/types/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { parseIntTransformer } from 'common/transformers/parse-int.transformer';

export default class RankingQueryDto {
  @ApiProperty({
    description: 'Period to get stats for',
    enum: StatsPeriod
  })
  @IsEnum(StatsPeriod)
  period!: StatsPeriod;

  @ApiProperty({
    description: 'Specific time to get stats for. Epoch timestamp in milliseconds'
  })
  @IsNumber()
  @Transform(parseIntTransformer())
  date!: number;

  @ApiProperty({
    description: 'Stat to order the results by',
    enum: StatType
  })
  @IsEnum(StatType)
  orderBy!: StatType;

  @ApiProperty({
    description: 'Direction to order by',
    enum: OrderDirection
  })
  @IsEnum(OrderDirection)
  orderDirection!: OrderDirection;

  @ApiProperty({
    description: 'Number of results to get. Max of 50'
  })
  @IsNumber()
  @Transform(parseIntTransformer({ max: 50 }))
  limit!: number;

  @ApiPropertyOptional({
    description: 'Cursor to start after'
  })
  @IsString()
  @IsOptional()
  cursor?: string;
}
