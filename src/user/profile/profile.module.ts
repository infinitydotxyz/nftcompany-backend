import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';

@Module({
  providers: [ProfileService],
  exports: [ProfileService]
})
export class ProfileModule {}
