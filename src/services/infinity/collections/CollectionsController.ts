import { InfinityTwitterAccount, Twitter } from '@services/twitter/Twitter';
import { ethers } from 'ethers';
import { Request, Response } from 'express';
import { error, log } from '@utils/logger';
import { jsonString } from '@utils/formatters';
import { StatusCode } from '@base/types/StatusCode';
import { firestore } from '@base/container';
import { fstrCnstnts, MIN_TWITTER_UPDATE_INTERVAL } from '@constants';
import { CollectionInfo, TwitterSnippet } from '@base/types/NftInterface';
import { getWeekNumber } from '@utils/index';
import { Keys } from '@base/types/UtilityTypes';
import { aggreagteHistorticalData } from '../aggregateHistoricalData';
import { getCollectionLinks } from '@services/opensea/collection/getCollection';
import { getCollectionStats } from '@services/opensea/collection/getCollectionStats';

interface FollowerData {
  followersCount: number;
  timestamp: number;
}

type FollowerDataAverages = Record<Keys<Omit<FollowerData, 'timestamp'>>, number>;
interface AggregatedFollowerData {
  weekStart: FollowerData;
  weekEnd: FollowerData;
  timestamp: number;
  averages: FollowerDataAverages;
}
export default class CollectionsController {
  /**
   *
   * @param req
   * @param res
   * @returns
   */
  async getCollectionInfo(req: Request<{ slug: string }>, res: Response) {
    const slugOrAddress = req.params.slug;
    try {
      log('Fetching collection info for', slugOrAddress);

      let collectionData: CollectionInfo | undefined;
      if (ethers.utils.isAddress(slugOrAddress)) {
        collectionData = await this.getCollectionInfoByAddress(slugOrAddress);
      } else {
        const data = await this.getCollectionInfoByName(slugOrAddress, 1);
        collectionData = data?.[0];
      }

      if (collectionData?.address) {
        const linksAndStats = await this.getLinksAndStats(collectionData.address);
        if (linksAndStats?.links) {
          collectionData.links = linksAndStats.links;
        }
        if (linksAndStats?.stats) {
          collectionData.stats = linksAndStats.stats;
        }
      }

      if (collectionData?.twitter) {
        collectionData.twitterSnippet = await this.getTwitterSnippet(collectionData.address, collectionData.twitter);
      }

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

  async getLinksAndStats(collectionAddress?: string) {
    if (!collectionAddress) {
      return { links: undefined, stats: undefined };
    }
    try {
      const links = await getCollectionLinks(collectionAddress);
      const stats = await (links?.slug ? getCollectionStats(links?.slug) : undefined);
      const linksWithTS = { ...links, timestamp: new Date(new Date().toISOString()).getTime() };
      let statsWithTS;
      if (stats) {
        statsWithTS = { ...stats, timestamp: new Date(new Date().toISOString()).getTime() };
      }
      return {
        links: linksWithTS,
        stats: statsWithTS
      };
    } catch (err) {
      error('error occurred while getting collection links and stats');
      error(err);
    }
  }

  /**
   * getCollectionInfoByAddress takes an addrss and returns the matching collection
   * info object if it exists
   *
   */
  async getCollectionInfoByAddress(address: string): Promise<CollectionInfo | undefined> {
    const doc = await firestore.collection(fstrCnstnts.ALL_COLLECTIONS_COLL).doc(address).get();

    if (doc.exists) {
      const data = doc.data() as CollectionInfo;
      return data;
    }
  }

  /**
   * getCollectionInfoByName takes a collection name/slug and a limit then returns an
   * array of the corresponding collection info objects
   *
   */
  async getCollectionInfoByName(searchCollectionName: string, limit: number): Promise<CollectionInfo[]> {
    const res = await firestore
      .collection(fstrCnstnts.ALL_COLLECTIONS_COLL)
      .where('searchCollectionName', '==', searchCollectionName)
      .limit(limit)
      .get();
    const data: CollectionInfo[] = res.docs.map((doc) => {
      return doc.data() as CollectionInfo;
    });

    return data;
  }

  async getTwitterSnippet(collectionAddress: string, twitterLink: string) {
    if (!collectionAddress || !twitterLink) {
      return;
    }
    // get snippet
    const twitterRef = firestore
      .collection(fstrCnstnts.ALL_COLLECTIONS_COLL)
      .doc(collectionAddress)
      .collection('socials')
      .doc('twitter');
    const twitterSnippet: TwitterSnippet = (await twitterRef.get()).data()?.twitterSnippet;

    const updatedTwitterSnippet = await this.updateTwitterData(twitterSnippet, collectionAddress, twitterLink);

    return updatedTwitterSnippet;
  }

  /**
   * updateTwitterData requests recent tweets from twitter (if it should be updated), saves the data to the database and
   * returns the updated collection info
   */
  private async updateTwitterData(
    twitterSnippet: TwitterSnippet,
    collectionAddress: string,
    twitterLink: string,
    force = false
  ): Promise<TwitterSnippet> {
    try {
      const now = new Date(new Date().toISOString()).getTime();
      const updatedAt: number =
        typeof twitterSnippet?.timestamp === 'number'
          ? twitterSnippet?.timestamp
          : new Date(new Date(0).toISOString()).getTime();
      if (force || (twitterLink && updatedAt + MIN_TWITTER_UPDATE_INTERVAL < now)) {
        let username = twitterSnippet?.account?.username;
        if (!username) {
          const twitterUsernameRegex = /twitter.com\/([a-zA-Z0-9_]*)/;
          username = twitterLink.match(twitterUsernameRegex)?.[1];
        }

        if (username) {
          // get twitter data
          const twitterClient = new Twitter();
          const twitterData = await twitterClient.getVerifiedAccountMentions(username);

          const newMentions = (twitterData?.tweets || []).map((item) => item.author);
          const mentions = [...(twitterSnippet?.topMentions ?? []), ...newMentions];
          const mentionsSortedByFollowerCount = mentions.sort(
            (userOne: InfinityTwitterAccount, userTwo: InfinityTwitterAccount) =>
              userTwo.followersCount - userOne.followersCount
          );
          const topMentions = mentionsSortedByFollowerCount.slice(0, 10);
          const date = new Date(now);
          const timestamp = now;

          const updatedTwitterSnippet: TwitterSnippet = {
            recentTweets: twitterData.tweets,
            timestamp,
            topMentions: topMentions,
            account: twitterData.account
          };

          const batch = firestore.db.batch();

          const collectionInfoRef = firestore.collection(fstrCnstnts.ALL_COLLECTIONS_COLL).doc(collectionAddress);
          const twitterRef = collectionInfoRef.collection('socials').doc('twitter');

          /**
           * update collection info tweet snippet
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

          const weekDocRef = twitterRef.collection('historical').doc(docId);

          /**
           * update historical data
           */
          batch.set(
            weekDocRef,
            {
              aggregated: { timestamp },
              [hourOfTheWeek]: { followersCount: twitterData.account?.followersCount, timestamp }
            },
            { merge: true }
          );

          // commit this batch so the updated data is available to aggregate the historical data
          await batch.commit();

          const batch2 = firestore.db.batch();

          const historicalRef = twitterRef.collection('historical');

          const aggregated = await aggreagteHistorticalData<FollowerData, AggregatedFollowerData>(
            historicalRef,
            10,
            batch2
          );

          /**
           *  update snippet with aggregated data
           */
          batch2.set(
            twitterRef,
            {
              twitterSnippet: {
                ...twitterSnippet,
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
    } catch (err) {
      error(`error while updating twitter data for ${collectionAddress}`);
      error(err);
    }
    return twitterSnippet;
  }
}
