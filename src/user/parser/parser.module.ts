import { Module } from '@nestjs/common';
import { PaginationModule } from 'pagination/pagination.module';
import { UserService } from 'user/user.service';
import { UserParserService } from './parser.service';

@Module({
  imports: [PaginationModule],
  providers: [UserService, UserParserService],
  exports: [UserService, UserParserService]
})
export class UserParserModule {}
