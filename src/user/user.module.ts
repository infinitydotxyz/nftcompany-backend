import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { StatsModule } from 'stats/stats.module';
import { VotesService } from 'votes/votes.service';

@Module({
  providers: [UserService, VotesService],
  imports: [StatsModule],
  controllers: [UserController]
})
export class UserModule {}
