import { ApiProperty } from '@nestjs/swagger';
import { CollectionSearchDto } from './collection-search.dto';

export class CollectionSearchArrayDto {
  @ApiProperty({ description: 'Array of collection data', type: [CollectionSearchDto] })
  data!: CollectionSearchDto[];

  @ApiProperty({ description: 'Cursor that can be used to get the next page' })
  cursor!: string;

  @ApiProperty({ description: 'Whether there are more results available' })
  hasNextPage!: boolean;
}
