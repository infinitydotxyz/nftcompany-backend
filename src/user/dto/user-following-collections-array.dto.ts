import { ApiProperty } from '@nestjs/swagger';
import { UserFollowingCollection } from './user-following-collection.dto';

export class UserFollowingCollectionsArrayDto {
  @ApiProperty({ description: 'Array of following collections', type: [UserFollowingCollection] })
  data: UserFollowingCollection[];

  @ApiProperty({ description: 'Cursor that can be used to get the next page' })
  cursor: string;

  @ApiProperty({ description: 'Whether there are more items available' })
  hasNextPage: boolean;
}
