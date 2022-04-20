import { ApiProperty } from '@nestjs/swagger/dist/decorators/api-property.decorator';
import { TopOwnerDto } from './top-owner.dto';

export class TopOwnersArrayResponseDto {
  @ApiProperty({ description: 'Array of top owners for the collection', type: [TopOwnerDto] })
  data: TopOwnerDto[];

  @ApiProperty({ description: 'Cursor that can be used to get the next page' })
  cursor: string;

  @ApiProperty({ description: 'Whether there are more results available' })
  hasNextPage: boolean;
}
