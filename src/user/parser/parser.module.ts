import { Module } from '@nestjs/common';
import { AlchemyModule } from 'alchemy/alchemy.module';
import { UserService } from 'user/user.service';
import { UserParserService } from './parser.service';

@Module({
  providers: [UserService, UserParserService],
  exports: [UserService, UserParserService],
  imports: [AlchemyModule]
})
export class UserParserModule {}
