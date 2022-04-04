import { Concrete, Keys } from '@infinityxyz/lib/types/core';
import { Tweet } from '@infinityxyz/lib/types/services/twitter';
import { User } from '@infinityxyz/lib/types/services/twitter';

export enum TwitterEndpoint {
  SearchTweets = 'tweets/search/recent',
  Users = 'users/by'
}

export type VerifiedMentionIncludes = Record<'users', VerifiedMentionUser[]>;

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

export type VerifiedMentionUser = Concrete<
  Pick<User, 'id' | 'name' | 'username' | 'public_metrics' | 'profile_image_url'>
>;
