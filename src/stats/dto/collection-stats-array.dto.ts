import { ApiProperty } from '@nestjs/swagger';
import { CollectionStatsDto } from './collection-stats.dto';

export class CollectionStatsArrayResponseDto {
  @ApiProperty({ description: 'Array of collection stats', type: [CollectionStatsDto] })
  data!: CollectionStatsDto[];

  @ApiProperty({ description: 'Cursor that can be used to get the next page' })
  cursor!: string;

  @ApiProperty({ description: 'Whether there are more results available' })
  hasNextPage!: boolean;
}
