import { ApiProperty } from '@nestjs/swagger';
import { UserFollowingUser } from './user-following-user.dto';

export class UserFollowingUsersArrayDto {
  @ApiProperty({ description: 'Array of following users', type: [UserFollowingUser] })
  data: UserFollowingUser[];

  @ApiProperty({ description: 'Cursor that can be used to get the next page' })
  cursor: string;

  @ApiProperty({ description: 'Whether there are more items available' })
  hasNextPage: boolean;
}
