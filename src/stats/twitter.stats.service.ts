import { Concrete } from '@infinityxyz/lib/types/core/UtilityTypes';
import { Tweet, User } from '@infinityxyz/lib/types/services/twitter';
import { SearchResponse } from '@infinityxyz/lib/types/services/twitter/SearchResponse';
import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { SocialsStats } from './socials.stats.interface';

/**
 * access level is Elevated
 * provides queries up to 512 chars
 */
enum Endpoint {
  /**
   * docs
   * https://developer.twitter.com/en/docs/twitter-api/tweets/search/introduction
   */
  SearchTweets = 'tweets/search/recent',
  Users = 'users/by'
}

export type TwitterStats = Pick<
  SocialsStats,
  'twitterFollowers' | 'twitterFollowing' | 'twitterHandle' | 'twitterId' | 'twitterLink'
>;

type CollectionTweets = Concrete<
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

type CollectionTweetsUser = Concrete<Pick<User, 'id' | 'name' | 'username' | 'public_metrics'>>;

type CollectionTweetsIncludes = Record<'users', CollectionTweetsUser[]>;
const TWITTER_BEARER_TOKEN = 'asdf'; // TODO

@Injectable()
export class TwitterStatsService {
  private readonly client: AxiosInstance;
  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.twitter.com/2/',
      headers: {
        Authorization: `Bearer ${TWITTER_BEARER_TOKEN}`
      }
    });
  }

  async getVerifiedMentions(username: string): Promise<any> {
    const query = `@${username} is:verified`;
    const response: AxiosResponse<SearchResponse<CollectionTweets, CollectionTweetsIncludes>> = await this.client.get(
      Endpoint.SearchTweets,
      {
        params: {
          query,
          expansions: 'author_id,entities.mentions.username',
          'tweet.fields': 'public_metrics,created_at',
          'user.fields': 'public_metrics'
        }
      }
    );
  }
}
