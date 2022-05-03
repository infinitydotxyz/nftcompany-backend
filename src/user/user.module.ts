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
import { AlchemyModule } from 'alchemy/alchemy.module';
import { MnemonicModule } from 'mnemonic/mnemonic.module';

@Module({
  providers: [UserService],
  imports: [
    StatsModule,
    VotesModule,
    StorageModule,
    DiscordModule,
    TwitterModule,
    ProfileModule,
    AlchemyModule,
    CollectionsModule,
    MnemonicModule
  ],
  controllers: [UserController],
  exports: [UserService]
})
export class UserModule {}
