import { Concrete } from '@base/types/Manipulators';
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
   * @param collectionTwitterAccount
   */
  async getCollectionTweets(collectionUsername: string) {
    try {
      /**
       * match any tweet that mentions the given username
       * and where the tweeter is verified
       *
       * can we get the mentioned account followers from here?
       */
      const query = `@${collectionUsername} is:verified`;
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
        console.log(response.data);
        const tweets = jsonBody.data;
        const first = tweets[0];
        const mentionone = first.entities.mentions[0];
      } else {
        /**
         *
         */
      }
    } catch (err) {
      console.log(err);
    }
  }

  private getTweetLink(username: string, tweetId: string) {
    return `https://twitter.com/${username}/status/${tweetId}`;
  }
}
