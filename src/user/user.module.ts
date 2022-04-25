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
import { AlchemyService } from 'alchemy/alchemy.service';
import { AlchemyNftToInfinityNft } from 'alchemy/alchemy-nft-to-infinity-nft.pipe';
import { ParseUserIdPipe } from './parser/parse-user-id.pipe';

@Module({
  providers: [UserService, ParseUserIdPipe, AlchemyService, AlchemyNftToInfinityNft],

@Module({
  providers: [UserService],
  imports: [StatsModule, VotesModule, CollectionsModule, StorageModule, DiscordModule, TwitterModule, ProfileModule],
  controllers: [UserController],
  exports: [UserService]
})
export class UserModule {}
