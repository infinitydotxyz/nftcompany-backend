import { Module } from '@nestjs/common';
import { FirebaseModule } from 'firebase/firebase.module';
import { CollectionController } from './collection.controller';
import CollectionService from './collection.service';

@Module({
  imports: [FirebaseModule],
  providers: [CollectionService],
  controllers: [CollectionController]
})
export class CollectionModule {}
