import { ChainId } from '@infinityxyz/lib/types/core';
import { UserProfileDto } from 'user/dto/user-profile.dto';

export type ParsedUserId = {
  userAddress: string;
  userChainId: ChainId;
  ref: FirebaseFirestore.DocumentReference<UserProfileDto>;
};
