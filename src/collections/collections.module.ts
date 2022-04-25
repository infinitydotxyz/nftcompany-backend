import { Module } from '@nestjs/common';
import { MnemonicModule } from 'mnemonic/mnemonic.module';
import { PaginationModule } from 'pagination/pagination.module';
import { StatsModule } from 'stats/stats.module';
import { TwitterModule } from 'twitter/twitter.module';
import { VotesModule } from 'votes/votes.module';
import { CollectionsController } from './collections.controller';
import CollectionsService from './collections.service';
import { NftsController } from './nfts/nfts.controller';
import { NftsService } from './nfts/nfts.service';

@Module({
  imports: [StatsModule, VotesModule, TwitterModule, MnemonicModule, PaginationModule],
  providers: [CollectionsService, NftsService],
  controllers: [CollectionsController, NftsController],
  exports: [CollectionsService, NftsService]
})
export class CollectionsModule {}
