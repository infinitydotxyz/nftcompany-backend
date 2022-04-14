import { PickType } from '@nestjs/swagger';
import { UserFollowingUser } from './user-following-user.dto';

export class UserFollowingUserPostPayload extends PickType(UserFollowingUser, [
  'userAddress',
  'userChainId'
] as const) {}
