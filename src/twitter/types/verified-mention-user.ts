import { Concrete } from '@infinityxyz/lib/types/core';
import { User } from '@infinityxyz/lib/types/services/twitter';

export type VerifiedMentionUser = Concrete<Pick<User, 'id' | 'name' | 'username' | 'public_metrics'>>;
