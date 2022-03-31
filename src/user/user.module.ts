import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { StatsModule } from 'stats/stats.module';
import { VotesModule } from 'votes/votes.module';

@Module({
  providers: [UserService],
  imports: [StatsModule, VotesModule],
  controllers: [UserController]
})
export class UserModule {}
