import { Concrete } from '@base/types/Manipulators';
import { error } from '@utils/logger';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { SearchResponse } from './types/SearchResponse';
import { Tweet } from './types/Tweet';
import { User } from './types/User';

/**
 * access level is Elevated
 * provides queries up to 512 chars
 */

enum Enpoint {
  /**
   * docs
   * https://developer.twitter.com/en/docs/twitter-api/tweets/search/introduction
   */
  SearchTweets = 'tweets/search/recent'
}

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

export interface InfinityTwitterAccount {
  id: string;
  name: string;
  username: string;
  followersCount: number;
  followingCount: number;
  tweetCount: number;
  listedCount: number;
}

export interface InfinityTweet {
  author: InfinityTwitterAccount;
  createdAt: number;
  tweetId: string;
  text: string;
  url: string;
}

export class Twitter {
  private readonly client: AxiosInstance;
  constructor() {
    const bearerToken = process.env.twitterBearerToken;

    this.client = axios.create({
      baseURL: 'https://api.twitter.com/2/',
      headers: {
        Authorization: `Bearer ${bearerToken}`
      }
    });
  }

  /**
   *
   * @param username
   */
  async getVerifiedAccountMentions(username: string): Promise<{
    account?: InfinityTwitterAccount;
    tweets: InfinityTweet[];
  }> {
    try {
      /**
       * match any tweet that mentions the given username
       * and where the tweeter is verified
       */
      const query = `@${username} is:verified`;
      const response: AxiosResponse<SearchResponse<CollectionTweets, CollectionTweetsIncludes>> = await this.client.get(
        Enpoint.SearchTweets,
        {
          params: {
            query,
            expansions: 'author_id,entities.mentions.username',
            'tweet.fields': 'public_metrics,created_at',
            'user.fields': 'public_metrics'
          }
        }
      );
      const jsonBody = response.data;
      if ('data' in jsonBody && jsonBody.data.length > 0) {
        const tweets = jsonBody.data ?? []; // ordered in reverse chronological order
        const users = jsonBody.includes?.users ?? [];

        const formattedTweets = tweets
          .map((tweet) => {
            const user = users.find((u) => u.id === tweet.author_id);
            const tweetUrl = user?.username ? this.getTweetLink(user?.username ?? '', tweet.id) : '';
            const author: InfinityTwitterAccount = {
              id: tweet.author_id,
              name: user?.name ?? '',
              username: user?.username ?? '',
              followersCount: user?.public_metrics?.followers_count ?? 0,
              followingCount: user?.public_metrics?.following_count ?? 0,
              tweetCount: user?.public_metrics.tweet_count ?? 0,
              listedCount: user?.public_metrics.listed_count ?? 0
            };
            const createdAt = new Date(tweet.created_at).getTime();
            return {
              author,
              createdAt: createdAt,
              tweetId: tweet.id,
              text: tweet.text,
              url: tweetUrl
            };
          })
          .filter((tweet) => {
            return !!tweet.url;
          });

        const accountUser = users.find((user) => user.username.toLowerCase() === username.toLowerCase());
        const accountInfo: InfinityTwitterAccount = {
          id: accountUser?.id ?? '',
          name: accountUser?.name ?? '',
          username,
          followersCount: accountUser?.public_metrics.followers_count ?? 0,
          followingCount: accountUser?.public_metrics.following_count ?? 0,
          tweetCount: accountUser?.public_metrics.tweet_count ?? 0,
          listedCount: accountUser?.public_metrics.listed_count ?? 0
        };

        return {
          account: accountInfo,
          tweets: formattedTweets
        };
      }
      return {
        account: undefined,
        tweets: []
      };
    } catch (err) {
      error(err);
      return {
        account: undefined,
        tweets: []
      };
    }
  }

  private getTweetLink(username: string, tweetId: string) {
    return `https://twitter.com/${username}/status/${tweetId}`;
  }
}
