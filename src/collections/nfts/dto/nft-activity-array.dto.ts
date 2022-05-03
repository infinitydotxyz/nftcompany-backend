import { ApiProperty } from '@nestjs/swagger';
import { NftActivity } from './nft-activity.dto';

export class NftActivityArrayDto {
  @ApiProperty({ description: 'Array of activities for the nft', type: [NftActivity] })
  data: NftActivity[];

  @ApiProperty({ description: 'Cursor that can be used to get the next page' })
  cursor: string;

  @ApiProperty({ description: 'Whether there are more results available' })
  hasNextPage: boolean;
}
