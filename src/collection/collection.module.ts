import { Module } from '@nestjs/common';
import { CollectionController } from './collection.controller';

@Module({
  controllers: [CollectionController]
})
export class CollectionModule {}
