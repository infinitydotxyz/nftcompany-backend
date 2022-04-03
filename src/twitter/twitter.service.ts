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
import { firestoreConstants, getWeekNumber } from '@infinityxyz/lib/utils';
import {
  VerifiedMentionTweet,
  VerifiedMentionIncludes,
  VerifiedMentionUser,
  TwitterEndpoint,
  AggregatedFollowerData,
  FollowerData
} from './twitter.types';
import { PaginatedQuery } from 'common/dto/paginated-query.dto';
import { base64Decode, base64Encode } from 'utils';
import { TweetDto } from './dto/tweet.dto';
import { TweetArrayDto } from './dto/tweet-array.dto';
import { ParsedCollectionId } from 'collections/collection-id.pipe';
import { TwitterSnippet } from '@infinityxyz/lib/types/core';
import { MIN_TWITTER_UPDATE_INTERVAL } from '../constants';
import { Twitter } from 'services/twitter/Twitter';
import { aggregateHistoricalData } from 'services/infinity/aggregateHistoricalData';

/**
 * Access level is Elevated
 * provides queries up to 512 chars
 *
 * docs: https://developer.twitter.com/en/docs/twitter-api/tweets/search/introduction
 */
@Injectable()
export class TwitterService {
  private readonly client: AxiosInstance;

  constructor(private config: ConfigService, private firebaseService: FirebaseService) {
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

    const limit = query.limit ?? FirebaseService.DEFAULT_ITEMS_PER_PAGE;

    let startAfterCursor;
    if (query.cursor) {
      try {
        startAfterCursor = JSON.parse(base64Decode(query.cursor));
      } catch (e) {}
    }

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
    const cursor = base64Encode(
      JSON.stringify({
        Id: lastItem?.author.id,
        FollowersCount: lastItem?.author.followersCount
      })
    );

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
      const account = this.transformAccount(accountUser);
      return { account, tweets: formattedTweets };
    } catch (err) {}

    try {
      const accountUser = await this.getUser(username);
      const account = this.transformAccount(accountUser);
      return { account, tweets: [] };
    } catch (err) {
      console.error(err);
    }

    throw new Error('Failed to get account and mentions');
  }

  async getTwitterSnippet(collection: ParsedCollectionId, twitterLink: string, forceUpdate = false) {
    if (!collection.address || !twitterLink) {
      return;
    }

    const twitterRef = collection.ref
      .collection(firestoreConstants.DATA_SUB_COLL)
      .doc(firestoreConstants.COLLECTION_TWITTER_DOC);

    const twitterSnippet: TwitterSnippet = (await twitterRef.get()).data()?.twitterSnippet;
    const updatedTwitterSnippet = await this.updateTwitterData(twitterSnippet, collection, twitterLink, forceUpdate);

    return updatedTwitterSnippet;
  }

  /**
   * UpdateTwitterData requests recent tweets from twitter (if it should be updated), saves the data to the database and
   * returns the updated collection info
   */
  private async updateTwitterData(
    twitterSnippet: TwitterSnippet,
    collection: ParsedCollectionId,
    twitterLink: string,
    force = false
  ): Promise<TwitterSnippet> {
    const now = new Date().getTime();
    const updatedAt: number = typeof twitterSnippet?.timestamp === 'number' ? twitterSnippet?.timestamp : 0;

    if (force || (twitterLink && now - updatedAt > MIN_TWITTER_UPDATE_INTERVAL)) {
      const twitterUsernameRegex = /twitter.com\/([a-zA-Z0-9_]*)/;
      const username = twitterLink.match(twitterUsernameRegex)?.[1];

      if (username) {
        // Get twitter data
        const twitterClient = new Twitter();
        const twitterData = await twitterClient.getVerifiedAccountMentions(username);

        const newMentions = (twitterData?.tweets || []).map((item) => item.author);
        const ids = new Set();
        const mentions = [...(twitterSnippet?.topMentions ?? []), ...newMentions]
          .sort((itemA, itemB) => itemB.followersCount - itemA.followersCount)
          .filter((item) => {
            if (!ids.has(item.id)) {
              ids.add(item.id);
              return true;
            }
            return false;
          });
        const mentionsSortedByFollowerCount = mentions.sort(
          (userOne: InfinityTwitterAccount, userTwo: InfinityTwitterAccount) =>
            userTwo.followersCount - userOne.followersCount
        );
        const topMentions = mentionsSortedByFollowerCount.slice(0, 10);
        const date = new Date(now);

        const account = twitterData.account ? { account: twitterData.account } : {};
        const updatedTwitterSnippet: TwitterSnippet = {
          recentTweets: twitterData.tweets,
          timestamp: now,
          topMentions: topMentions,
          ...account
        };

        const batch = this.firebaseService.firestore.batch();

        const twitterRef = collection.ref
          .collection(firestoreConstants.DATA_SUB_COLL)
          .doc(firestoreConstants.COLLECTION_TWITTER_DOC);

        /**
         * Update collection info tweet snippet
         */
        batch.set(
          twitterRef,
          {
            twitterSnippet: updatedTwitterSnippet
          },
          { merge: true }
        );

        const [year, week] = getWeekNumber(date);
        const docId = `${year}-${week}`;
        const hourOfTheWeek = `${date.getUTCDay() * 24 + date.getUTCHours()}`;
        const weekDocRef = twitterRef.collection(firestoreConstants.HISTORICAL_COLL).doc(docId);

        /**
         * Update historical data
         */
        batch.set(
          weekDocRef,
          {
            aggregated: { timestamp: now },
            [hourOfTheWeek]: { followersCount: twitterData.account?.followersCount ?? 0, timestamp: now }
          },
          { merge: true }
        );

        // Commit this batch so the updated data is available to aggregate the historical data
        await batch.commit();

        const batch2 = this.firebaseService.firestore.batch();

        const historicalRef = twitterRef.collection(firestoreConstants.HISTORICAL_COLL);

        const aggregated = await aggregateHistoricalData<FollowerData, AggregatedFollowerData>(
          historicalRef,
          10,
          batch2
        );

        /**
         *  Update snippet with aggregated data
         */
        batch2.set(
          twitterRef,
          {
            twitterSnippet: {
              ...updatedTwitterSnippet,
              aggregated
            }
          },
          { merge: true }
        );

        await batch2.commit();

        return {
          ...updatedTwitterSnippet
        };
      }
    }

    return twitterSnippet;
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
