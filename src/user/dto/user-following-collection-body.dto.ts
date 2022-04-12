import { PickType } from '@nestjs/swagger';
import { UserFollowingCollection } from './user-following-collection.dto';

export class UserFollowingCollectionBody extends PickType(UserFollowingCollection, [
  'collectionAddress',
  'collectionChainId'
] as const) {}
