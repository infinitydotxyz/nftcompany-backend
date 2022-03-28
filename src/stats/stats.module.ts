import { Module } from '@nestjs/common';
import { DiscordModule } from 'discord/discord.module';
import { TwitterModule } from 'twitter/twitter.module';
import { StatsService } from './stats.service';

@Module({
  imports: [TwitterModule, DiscordModule],
  providers: [StatsService],
  exports: [StatsService]
})
export class StatsModule {}
