import { StorageService } from './storage.service';
import { Module } from '@nestjs/common';

@Module({
  imports: [],
  controllers: [],
  providers: [StorageService],
  exports: [StorageService]
})
export class StorageModule {}
