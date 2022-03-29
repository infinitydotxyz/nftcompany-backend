import { Module } from '@nestjs/common';
import { CollectionModule } from 'collection/collection.module';
import { NftController } from './nft.controller';
import { NftService } from './nft.service';

@Module({
  controllers: [NftController],
  providers: [NftService],
  imports: [CollectionModule]
})
export class NftModule {}
