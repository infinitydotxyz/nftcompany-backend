import { StatsPeriod } from '@infinityxyz/lib/types/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional } from 'class-validator';
import { IsEnumArray } from 'common/decorators/is-enum-array.decorator';
import { parseIntTransformer } from 'common/transformers/parse-int.transformer';

export class CollectionStatsQueryDto {
  @ApiProperty({
    description: 'Period(s) to get stats for',
    enum: StatsPeriod,
    type: [StatsPeriod]
  })
  @IsEnumArray(StatsPeriod, { message: 'Invalid period' })
  period: StatsPeriod;

  @ApiPropertyOptional({
    description: 'Specific time to get stats for. Epoch timestamp in milliseconds. Defaults to current time'
  })
  @IsOptional()
  @IsNumber()
  @Transform(parseIntTransformer({ optional: true }))
  date?: number;
}
