import { ApiProperty } from '@nestjs/swagger';

export class CollectionStateExportDto {
  @ApiProperty({
    description: 'Whether the collection has been exported'
  })
  done!: boolean;
}
