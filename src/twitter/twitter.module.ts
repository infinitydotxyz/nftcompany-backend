import { Module } from '@nestjs/common';
import { PaginationModule } from 'pagination/pagination.module';
import { TwitterService } from './twitter.service';

@Module({
  providers: [TwitterService],
  exports: [TwitterService],
  imports: [PaginationModule]
})
export class TwitterModule {}
