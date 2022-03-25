import { Module } from '@nestjs/common';
import { StatsModule } from 'stats/stats.module';
import { CollectionsController } from './collections.controller';

@Module({
  imports: [StatsModule],
  controllers: [CollectionsController]
})
export class CollectionsModule {}
