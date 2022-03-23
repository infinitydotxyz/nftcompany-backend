import { Module } from '@nestjs/common';
import { StatsModule } from 'stats/stats.module';
import { CollectionController } from './collection.controller';
import CollectionService from './collection.service';

@Module({
  imports: [StatsModule],
  providers: [CollectionService],
  controllers: [CollectionController]
})
export class CollectionModule {}
