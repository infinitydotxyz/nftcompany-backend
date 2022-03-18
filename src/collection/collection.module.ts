import { Module } from '@nestjs/common';
import { CollectionController } from './collection.controller';
import CollectionService from './collection.service';

@Module({
  imports: [],
  providers: [CollectionService],
  controllers: [CollectionController]
})
export class CollectionModule {}
