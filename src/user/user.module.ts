import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { StatsModule } from 'stats/stats.module';
import { VotesModule } from 'votes/votes.module';
import { CollectionsModule } from 'collections/collections.module';
import { StorageModule } from 'storage/storage.module';
import { DiscordModule } from 'discord/discord.module';
import { TwitterModule } from 'twitter/twitter.module';
import { ProfileModule } from './profile/profile.module';
import { PaginationModule } from 'pagination/pagination.module';

@Module({
  imports: [
    StatsModule,
    VotesModule,
    CollectionsModule,
    StorageModule,
    DiscordModule,
    TwitterModule,
    ProfileModule,
    PaginationModule
  ],
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService]
})
export class UserModule {}
