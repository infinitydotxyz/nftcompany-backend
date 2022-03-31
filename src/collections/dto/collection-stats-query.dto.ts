import { StatsPeriod } from '@infinityxyz/lib/types/core';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnumArray } from 'common/decorators/is-enum-array.decorator';
import { arrayTransformer } from 'common/transformers/array-query.transformer';

export class CollectionStatsQueryDto {
  @ApiProperty({
    description: 'Periods to get stats for',
    enum: StatsPeriod,
    type: [StatsPeriod]
  })
  @IsEnumArray(StatsPeriod, { message: 'Invalid periods' })
  @Transform(arrayTransformer)
  periods: StatsPeriod[];
}
