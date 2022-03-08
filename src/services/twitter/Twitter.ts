import { TWITTER_BEARER_TOKEN } from '../../constants';
import { Concrete } from '@infinityxyz/lib/types/core';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  SearchResponse,
  InfinityTweet,
  InfinityTwitterAccount,
  Tweet,
  User,
  TwitterUserResponse
} from '@infinityxyz/lib/types/services/twitter';

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

export class Twitter {
  private readonly client: AxiosInstance;
  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.twitter.com/2/',
      headers: {
        Authorization: `Bearer ${TWITTER_BEARER_TOKEN}`
      }
    });
  }

  /**
   * getVerifiedAccountMentions first attempts to get mentions of the specified username
   * by verified users along with an account object for the passed user. If this fails (no recent verified mentions)
   * we attempt to get the account object and return an empty array for the tweets
   */
  async getVerifiedAccountMentions(username: string): Promise<{
    account?: InfinityTwitterAccount;
    tweets: InfinityTweet[];
  }> {
    /**
     * match any tweet that mentions the given username
     * and where the tweeter is verified
     */
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
    } else if (jsonBody.meta.result_count === 0) {
      // no recent tweets,
      const response: AxiosResponse<
        TwitterUserResponse<Concrete<Pick<User, 'id' | 'public_metrics' | 'name' | 'username'>>>
      > = await this.client.get(Endpoint.Users, {
        params: {
          usernames: username,
          'user.fields': 'public_metrics'
        }
      });

      const body = response.data;

      if ('errors' in body) {
        throw new Error(body.errors?.[0].detail);
      }

      const account = body.data?.[0];
      if (
        account.id &&
        account.name &&
        account.username &&
        typeof account.public_metrics.followers_count === 'number' &&
        typeof account.public_metrics.following_count === 'number'
      ) {
        return {
          account: {
            id: account.id,
            name: account.name,
            username: account.username,
            followersCount: account.public_metrics.followers_count,
            followingCount: account.public_metrics.following_count
          },
          tweets: []
        };
      }
    }

    throw new Error(`Failed to get twitter account for ${username}`);
  }

  private getTweetLink(username: string, tweetId: string) {
    return `https://twitter.com/${username}/status/${tweetId}`;
  }
}
