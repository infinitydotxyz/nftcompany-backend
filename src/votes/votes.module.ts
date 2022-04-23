import { Module } from '@nestjs/common';
import { PaginationModule } from 'pagination/pagination.module';
import { VotesService } from './votes.service';

@Module({
  providers: [VotesService],
  exports: [VotesService],
  imports: [PaginationModule]
})
export class VotesModule {}
