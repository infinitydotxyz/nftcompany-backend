import { PickType } from '@nestjs/swagger';
import { UserFollowingCollection } from './user-following-collection.dto';

export class UserFollowingCollectionDeletePayload extends PickType(UserFollowingCollection, [
  'collectionAddress',
  'collectionChainId'
] as const) {}
