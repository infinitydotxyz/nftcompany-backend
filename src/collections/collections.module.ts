import { Module } from '@nestjs/common';
import { StatsModule } from 'stats/stats.module';
import { VotesModule } from 'votes/votes.module';
import { CollectionsController } from './collections.controller';
import CollectionsService from './collections.service';
import { NftsController } from './nfts/nfts.controller';
import { NftsService } from './nfts/nfts.service';

@Module({
  imports: [StatsModule, VotesModule],
  providers: [CollectionsService, NftsService],
  controllers: [CollectionsController, NftsController]
})
export class CollectionsModule {}
