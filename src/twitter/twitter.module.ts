import { Module } from '@nestjs/common';
import { TwitterService } from './twitter.service';

@Module({
  exports: [TwitterService]
})
export class TwitterModule {}
