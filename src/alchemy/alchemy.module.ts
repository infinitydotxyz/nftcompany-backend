import { Module } from '@nestjs/common';
import { CollectionsModule } from 'collections/collections.module';
import { AlchemyNftToInfinityNft } from './alchemy-nft-to-infinity-nft.pipe';
import { AlchemyService } from './alchemy.service';

@Module({
  providers: [AlchemyService, AlchemyNftToInfinityNft],
  imports: [CollectionsModule],
  exports: [AlchemyService, AlchemyNftToInfinityNft]
})
export class AlchemyModule {}
