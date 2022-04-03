import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { StatsModule } from 'stats/stats.module';
import { VotesModule } from 'votes/votes.module';
import { CollectionsModule } from 'collections/collections.module';
import { StorageModule } from 'storage/storage.module';

@Module({
  providers: [UserService],
  imports: [StatsModule, VotesModule, CollectionsModule, StorageModule],
  controllers: [UserController]
})
export class UserModule {}
