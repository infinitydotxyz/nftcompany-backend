import { InfinityTwitterAccount, Twitter } from '@services/twitter/Twitter';
import { ethers } from 'ethers';
import { getCollectionByAddress } from './getCollectionByAddress';
import { getCollectionInfoByName } from './getCollectionInfoByName';
import { Request, Response } from 'express';
import { error, log } from '@utils/logger';
import { jsonString } from '@utils/formatters';
import { StatusCode } from '@base/types/StatusCode';
import { firestore } from '@base/container';
import { fstrCnstnts } from '@constants';

export default class CollectionsController {
  async getCollectionInfo(req: Request<{ slug: string }>, res: Response) {
    const slugOrAddress = req.params.slug;
    try {
      log('Fetching collection info for', slugOrAddress);

      let collectionData;
      if (ethers.utils.isAddress(slugOrAddress)) {
        collectionData = await getCollectionByAddress(slugOrAddress);
      } else {
        const data = await getCollectionInfoByName(slugOrAddress, 1);
        collectionData = data?.[0];
      }

      collectionData = await this.refreshTweets(collectionData);

      const respStr = jsonString(collectionData);
      // to enable cdn cache
      res.set({
        'Cache-Control': 'must-revalidate, max-age=60',
        'Content-Length': Buffer.byteLength(respStr, 'utf8')
      });
      res.send(respStr);
      return;
    } catch (err) {
      error('Failed to get collection info for', slugOrAddress, err);
      res.sendStatus(StatusCode.InternalServerError);
    }
  }

  async refreshTweets(collectionData: any) {
    const twitterLink: string = collectionData?.twitter ?? '';
    const now = Date.now();
    const ONE_HOUR = 3600000;
    const updatedAt: number =
      typeof collectionData?.twitterSnippet?.updatedAt === 'number' ? collectionData?.twitterSnippet?.updatedAt : 0;
    if (twitterLink && updatedAt + ONE_HOUR < now) {
      let username = collectionData?.twitterSnippet?.username;
      if (!username) {
        const twitterUsernameRegex = /twitter.com\/([a-zA-Z0-9_]*)/;
        username = twitterLink.match(twitterUsernameRegex)?.[1];
      }

      if (username) {
        // update twitter
        const twitterClient = new Twitter();
        const twitterData = await twitterClient.getVerifiedAccountMentions(username);

        const newMentions = (twitterData?.tweets || []).map((item) => item.author);
        const mentions = [...(collectionData.twitterSnippet?.topMentions || []), ...newMentions];
        const mentionsSortedByFollowerCount = mentions.sort(
          (userOne: InfinityTwitterAccount, userTwo: InfinityTwitterAccount) =>
            userTwo.followersCount - userOne.followersCount
        );
        const topMentions = mentionsSortedByFollowerCount.slice(0, 10);

        const twitterSnippet = {
          recentTweets: twitterData,
          updatedAt: now,
          topMentions: topMentions
        };

        // Get a new write batch
        const batch = firestore.db.batch();
        const collectionInfoRef = firestore.collection(fstrCnstnts.ALL_COLLECTIONS_COLL).doc(collectionData.address);
        /**
         * update collection info tweet snippet
         */
        batch.set(
          collectionInfoRef,
          {
            twitterSnippet
          },
          { merge: true }
        );

        const twitterRef = firestore.collection(fstrCnstnts.TWITTER_COLL).doc(collectionData.address);
        const tweetsRef = twitterRef.collection(fstrCnstnts.TWEETS_COLL);
        const mentionsRef = twitterRef.collection(fstrCnstnts.MENTIONS_COLL);
        const historicalTwitterStats = twitterRef.collection(fstrCnstnts.HISTORICAL_TWITTER_ACCOUNT);

        /**
         * save tweets
         */
        for (const tweet of twitterData.tweets) {
          const tweetDocRef = tweetsRef.doc(tweet.tweetId);
          batch.set(tweetDocRef, tweet);
        }

        /**
         * save mentions
         */
        for (const user of newMentions) {
          const userMentionDoc = mentionsRef.doc(user.id);
          batch.set(userMentionDoc, user);
        }

        /**
         * save historical followers data point
         */
        // batch.set(historicalFollowersRef, )
        const account = twitterData.account;
        if (account) {
          const dataPointRef = historicalTwitterStats.doc(now.toString());
          const dataPoint = { ...account, timestamp: now };
          batch.create(dataPointRef, dataPoint);
        }

        await batch.commit();

        return twitterSnippet;
      }
    }

    return collectionData;
  }
}
