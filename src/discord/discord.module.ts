import { Module } from '@nestjs/common';
import { DiscordService } from './discord.service';

@Module({
  exports: [DiscordService]
})
export class DiscordModule {}
