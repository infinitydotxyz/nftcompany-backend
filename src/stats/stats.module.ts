import { Module } from '@nestjs/common';
import { TwitterStatsService } from './twitter.stats.service';

@Module({
  providers: [TwitterStatsService]
})
export class StatsModule {}
