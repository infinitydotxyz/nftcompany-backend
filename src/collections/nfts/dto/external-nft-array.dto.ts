import { ApiProperty } from '@nestjs/swagger';
import { ExternalNftDto } from './external-nft.dto';

export class ExternalNftArrayDto {
  @ApiProperty({ description: 'Array of nfts', type: [ExternalNftDto] })
  data: ExternalNftDto[];

  @ApiProperty({ description: 'Cursor that can be used to get the next page' })
  cursor: string;

  @ApiProperty({ description: 'Whether there are more results available' })
  hasNextPage: boolean;
}
