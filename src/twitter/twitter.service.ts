import {
  InfinityTweet,
  InfinityTwitterAccount,
  SearchResponse,
  TwitterUserResponse
} from '@infinityxyz/lib/types/services/twitter';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { FirebaseService } from '../firebase/firebase.service';
import { EnvironmentVariables } from 'types/environment-variables.interface';
import { DEFAULT_ITEMS_PER_PAGE, firestoreConstants } from '@infinityxyz/lib/utils';
import { VerifiedMentionTweet, VerifiedMentionIncludes, VerifiedMentionUser, TwitterEndpoint } from './twitter.types';
import { PaginatedQuery } from 'common/dto/paginated-query.dto';
import { TweetDto } from './dto/tweet.dto';
import { TweetArrayDto } from './dto/tweet-array.dto';
import { CursorService } from 'pagination/cursor.service';

/**
 * Access level is Elevated
 * provides queries up to 512 chars
 *
 * docs: https://developer.twitter.com/en/docs/twitter-api/tweets/search/introduction
 */
@Injectable()
export class TwitterService {
  private readonly client: AxiosInstance;

  constructor(
    private config: ConfigService,
    private firebaseService: FirebaseService,
    private paginationService: CursorService
  ) {
    const bearer = this.config.get<EnvironmentVariables>('twitterBearerToken');

    this.client = axios.create({
      baseURL: 'https://api.twitter.com/2/',
      headers: {
        Authorization: `Bearer ${bearer}`
      }
    });
  }

  static extractTwitterUsername(url: string) {
    const split = url.replace(/\/+$/, '').split('/');
    return split[split.length - 1].replace('@', '');
  }

  static appendTwitterUsername(username: string) {
    return `https://twitter.com/${username}`;
  }

  async saveCollectionMentions(collectionRef: FirebaseFirestore.DocumentReference, tweets: InfinityTweet[]) {
    const mentionsCollection = collectionRef.collection(firestoreConstants.COLLECTION_MENTIONS_COLL);
    const batch = this.firebaseService.firestore.batch();

    for (const tweet of tweets) {
      const tweetRef = mentionsCollection.doc(tweet.author.id); // Only store one tweet per author
      batch.set(tweetRef, tweet);
    }

    await batch.commit();
  }

  async getCollectionTopMentions(
    collectionRef: FirebaseFirestore.DocumentReference,
    query: PaginatedQuery
  ): Promise<TweetArrayDto> {
    const mentionsRef = collectionRef.collection(firestoreConstants.COLLECTION_MENTIONS_COLL);

    const limit = query.limit ?? DEFAULT_ITEMS_PER_PAGE;

    const startAfterCursor = this.paginationService.decodeCursorToObject<{ id?: string; followersCount?: number }>(
      query.cursor || ''
    );

    let topMentionsQuery = mentionsRef.orderBy('author.followersCount', 'desc').orderBy('author.id');

    if (startAfterCursor?.id && startAfterCursor?.followersCount) {
      topMentionsQuery = topMentionsQuery.startAfter(startAfterCursor.followersCount, startAfterCursor.id);
    }

    topMentionsQuery = topMentionsQuery.limit(limit + 1); // +1 to check if there are more results

    const topMentionsSnapshot = await topMentionsQuery.get();

    const topMentions = topMentionsSnapshot.docs.map((doc) => doc.data()) as TweetDto[];

    const hasNextPage = topMentions.length > limit;

    if (hasNextPage) {
      topMentions.pop(); // Remove the last item used to check for more results
    }

    const lastItem = topMentions?.[topMentions?.length - 1];
    const cursor = this.paginationService.encodeCursor({
      id: lastItem?.author.id,
      followersCount: lastItem?.author.followersCount
    });

    return {
      data: topMentions,
      cursor,
      hasNextPage
    };
  }

  /**
   * First attempts to get verified mentions
   * if that fails (typically when there are no verified mentions)
   * then, just get the user
   */
  async getAccountAndMentions(username: string): Promise<{ account: InfinityTwitterAccount; tweets: InfinityTweet[] }> {
    try {
      const { tweets, users } = await this.getVerifiedMentions(username);
      const formattedTweets = this.transformTweets(tweets, users);
      const accountUser = users.find((user) => user.username.toLowerCase() === username.toLowerCase());

      if (accountUser) {
        const account = this.transformAccount(accountUser);
        return { account, tweets: formattedTweets };
      }
    } catch (err: any) {
      console.log(err);
    }

    try {
      const accountUser = await this.getUser(username);
      const account = this.transformAccount(accountUser);
      return { account, tweets: [] };
    } catch (err: any) {
      console.error(err);
    }

    throw new Error('Failed to get account and mentions');
  }

  /**
   * Get verified mentions of the given account
   * returned user array contains the mentioned account and
   * all accounts who mentioned the given account
   */
  private async getVerifiedMentions(username: string) {
    /**
     * Match any tweet that mentions the given username
     * and where the tweeter is verified
     */
    const query = `@${username} is:verified`;
    const response: AxiosResponse<SearchResponse<VerifiedMentionTweet, VerifiedMentionIncludes>> =
      await this.client.get(TwitterEndpoint.SearchTweets, {
        params: {
          query,
          expansions: 'author_id,entities.mentions.username',
          'tweet.fields': 'public_metrics,created_at',
          'user.fields': 'public_metrics,profile_image_url'
        }
      });
    const body = response.data;

    if ('errors' in body) {
      throw new Error((body as any).errors?.[0].detail);
    } else if ('data' in body) {
      const tweets = body.data ?? []; // Ordered in reverse chronological order
      const users = body.includes?.users ?? [];
      return { tweets, users };
    }

    throw new Error('Failed to get mentions');
  }

  /**
   * Get a specific user
   */
  private async getUser(username: string) {
    const response: AxiosResponse<TwitterUserResponse<VerifiedMentionUser>> = await this.client.get(
      TwitterEndpoint.Users,
      {
        params: {
          usernames: username,
          'user.fields': 'public_metrics'
        }
      }
    );

    const body = response.data;

    if ('errors' in body) {
      throw new Error(body.errors?.[0].detail);
    }

    const account = body.data?.[0];
    return account;
  }

  private transformAccount(user: VerifiedMentionUser): InfinityTwitterAccount {
    const account: InfinityTwitterAccount = {
      id: user.id,
      name: user.name,
      username: user.username,
      followersCount: user.public_metrics.followers_count ?? 0,
      followingCount: user.public_metrics.following_count ?? 0,
      tweetCount: user.public_metrics.tweet_count ?? 0,
      listedCount: user.public_metrics.listed_count ?? 0,
      profileImageUrl: user.profile_image_url ?? ''
    };
    return account;
  }

  private transformTweets(tweets: VerifiedMentionTweet[], users: VerifiedMentionUser[]): InfinityTweet[] {
    const formattedTweets = tweets
      .map((tweet) => {
        const user = users.find((u) => u.id === tweet.author_id);
        const tweetUrl = user?.username ? this.formatTweetLink(user?.username ?? '', tweet.id) : '';
        const author: InfinityTwitterAccount = {
          id: tweet.author_id,
          name: user?.name ?? '',
          username: user?.username ?? '',
          followersCount: user?.public_metrics?.followers_count ?? 0,
          followingCount: user?.public_metrics?.following_count ?? 0,
          tweetCount: user?.public_metrics.tweet_count ?? 0,
          listedCount: user?.public_metrics.listed_count ?? 0,
          profileImageUrl: user?.profile_image_url ?? ''
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

    return formattedTweets;
  }

  private formatTweetLink(username: string, tweetId: string) {
    return `https://twitter.com/${username}/status/${tweetId}`;
  }
}
