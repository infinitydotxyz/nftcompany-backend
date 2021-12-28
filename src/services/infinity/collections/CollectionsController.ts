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
import { OrderDirection } from '@base/types/Queries';
import { HistoricalWeek } from '@base/types/Historical';

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

      let collectionData;
      if (ethers.utils.isAddress(slugOrAddress)) {
        collectionData = await this.getCollectionInfoByAddress(slugOrAddress);
      } else {
        const data = await this.getCollectionInfoByName(slugOrAddress, 1);
        collectionData = data?.[0];
      }

      if (collectionData) {
        collectionData = await this.getTwitterSnippet(collectionData.address, collectionData.twitter ?? '');
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
      return {};
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
    twitterLink: string
  ): Promise<TwitterSnippet> {
    try {
      const now = new Date(new Date().toISOString()).getTime();
      const updatedAt: number =
        typeof twitterSnippet?.timestamp === 'number'
          ? twitterSnippet?.timestamp
          : new Date(new Date(0).toISOString()).getTime();
      if (twitterLink && updatedAt + MIN_TWITTER_UPDATE_INTERVAL < now) {
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

          // Get a new write batch
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

          await batch.commit();

          return updatedTwitterSnippet;
        }
      }
    } catch (err) {
      error(`error while updating twitter data for ${collectionAddress}`);
      error(err);
    }
    return twitterSnippet;
  }

  private async aggreagteHistorticalData(
    historicalRef: FirebaseFirestore.CollectionReference<FirebaseFirestore.DocumentData>
  ) {
    // const twitterRef = firestore
    //   .collection(fstrCnstnts.ALL_COLLECTIONS_COLL)
    //   .doc('asdf')
    //   .collection('socials')
    //   .doc('twitter')
    //   .collection('historical');
    const weeklyDocs = historicalRef.orderBy('aggreagted.timestamp', OrderDirection.Descending).limit(10);

    type HistoricalTwitterData = HistoricalWeek<{ followersCount: number; timestamp: number }, { timestamp: number }>;
    const weeklyData: HistoricalTwitterData[] = ((await weeklyDocs.get())?.docs ?? [])?.map((doc) =>
      doc.data()
    ) as HistoricalTwitterData[];
    console.log(weeklyData);

    /**
     * aggregated data
     *
     * 24 hour datapoints
     * 10 weeks of datapoints (1 point per day)
     */
    // let twentyFourHourChange;
    // const previousWeek = weeklyData[0];

    // for (const week of weeklyData) {
    //   const aggreagated = week.aggregated;
    //   console.log(aggreagated);
    //   const hours = Object.entries(week).filter(([key]) => key !== 'aggregated');
    //   const sum = 0;
    //   for (const hour of hours) {
    //     console.log(hour);
    //   }
    // }
  }
}
