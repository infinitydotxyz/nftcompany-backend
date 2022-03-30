import { StatsPeriod } from '@infinityxyz/lib/types/core';
import { ApiProperty } from '@nestjs/swagger';
import { CollectionStatsDto } from 'stats/dto/collection-stats.dto';

export class CollectionStatsByPeriod {
  @ApiProperty({
    description: 'All time stats'
  })
  [StatsPeriod.All]: CollectionStatsDto;

  @ApiProperty({
    description: 'Hourly stats'
  })
  [StatsPeriod.Hourly]: CollectionStatsDto;

  @ApiProperty({
    description: 'Daily stats'
  })
  [StatsPeriod.Daily]: CollectionStatsDto;

  @ApiProperty({
    description: 'Weekly stats'
  })
  [StatsPeriod.Weekly]: CollectionStatsDto;

  @ApiProperty({
    description: 'Monthly stats'
  })
  [StatsPeriod.Monthly]: CollectionStatsDto;

  @ApiProperty({
    description: 'Yearly stats'
  })
  [StatsPeriod.Yearly]: CollectionStatsDto;
}
