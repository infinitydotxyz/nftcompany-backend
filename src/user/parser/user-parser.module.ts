import { Module } from '@nestjs/common';
import { UserService } from 'user/user.service';
import { UserParserService } from './user-parser.service';

@Module({
  providers: [UserService, UserParserService],
  exports: [UserService, UserParserService]
})
export class UserParserModule {}
