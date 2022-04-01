import { ApiProperty } from '@nestjs/swagger';
import { CollectionStateCreateDto } from './collection-state-create.dto';
import { CollectionStateExportDto } from './collection-state-export.dto';

export class CollectionStateDto {
  @ApiProperty({
    description: 'Current version number of the collection schema'
  })
  version: number;

  @ApiProperty({
    description: 'Current state of the collection creation process'
  })
  create: CollectionStateCreateDto;

  @ApiProperty({
    description: 'Current state of the collection export process'
  })
  export: CollectionStateExportDto;
}
