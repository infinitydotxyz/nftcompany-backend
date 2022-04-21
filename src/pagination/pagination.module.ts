import { Module } from '@nestjs/common';
import { CursorService } from './cursor.service';

@Module({
  providers: [CursorService],
  exports: [CursorService]
})
export class PaginationModule {}
