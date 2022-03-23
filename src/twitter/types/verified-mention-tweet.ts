import { Concrete } from '@infinityxyz/lib/types/core';
import { Tweet } from '@infinityxyz/lib/types/services/twitter';

export type VerifiedMentionTweet = Concrete<
  Pick<Tweet, 'id' | 'text' | 'created_at' | 'entities' | 'public_metrics' | 'author_id'>
> & {
  entities: {
    mentions: Array<{
      start: number;
      end: number;
      username: string;
      id: string;
    }>;
  };
};
