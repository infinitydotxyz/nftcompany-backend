import { InfinityTwitterAccount, Twitter } from '@services/twitter/Twitter';
import { ethers } from 'ethers';
import { Request, Response } from 'express';
import { error, log } from '@utils/logger';
import { jsonString } from '@utils/formatters';
import { StatusCode } from '@base/types/StatusCode';
import { firestore } from '@base/container';
import {
  fstrCnstnts,
  MIN_COLLECTION_STATS_UPDATE_INTERVAL,
  MIN_DISCORD_UPDATE_INTERVAL,
  MIN_LINK_UPDATE_INTERVAL,
  MIN_TWITTER_UPDATE_INTERVAL,
  ONE_DAY
} from '@constants';
import { CollectionInfo, DiscordSnippet, Links, CollectionStats, TwitterSnippet } from '@base/types/NftInterface';
import { getWeekNumber } from '@utils/index';
import { Keys } from '@base/types/UtilityTypes';
import { aggreagteHistorticalData, averageHistoricalData } from '../aggregateHistoricalData';
import { getCollectionLinks } from '@services/opensea/collection/getCollection';
import { getCollectionStats } from '@services/opensea/collection/getCollectionStats';
import { DiscordAPI } from '@services/discord/DiscordAPI';
import { WithTimestamp } from '@base/types/Historical';

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

interface DiscordHistoricalData {
  timestamp: number;
  presenceCount: number;
  membersCount: number;
}
interface TwitterHistoricalData {
  timestamp: number;
  followers: number;
}

export default class CollectionsController {
  /**
   * getCollectionInfo handles a request for collection info by slug or collection address
   */
  async getCollectionInfo(req: Request<{ slug: string }>, res: Response) {
    const slugOrAddress = req.params.slug;
    try {
      log('Fetching collection info for', slugOrAddress);

      type CollectionData = CollectionInfo & { links?: Links; stats?: CollectionStats };

      let collectionData: CollectionData | undefined;

      /**
       * get base collection info
       */
      if (ethers.utils.isAddress(slugOrAddress)) {
        collectionData = await this.getCollectionInfoByAddress(slugOrAddress);
      } else {
        const data = await this.getCollectionInfoByName(slugOrAddress, 1);
        collectionData = data?.[0];
      }

      /**
       * get links and stats
       * links are required for updating discord and twitter snippets
       */
      if (collectionData?.address) {
        const linksAndStats = await this.getLinksAndStats(collectionData.address);
        if (linksAndStats?.links) {
          collectionData.links = linksAndStats.links;
        }
        if (linksAndStats?.stats) {
          collectionData.stats = linksAndStats.stats;
        }
      }

      const promises: Array<Promise<DiscordSnippet | TwitterSnippet | undefined>> = [];
      let discordSnippetPromise: Promise<DiscordSnippet | undefined>;
      if (collectionData?.links?.discord) {
        discordSnippetPromise = this.getDiscordSnippet(collectionData.address, collectionData.links.discord);
        promises.push(discordSnippetPromise);
      }

      let twitterSnippetPromise: Promise<TwitterSnippet | undefined>;
      if (collectionData?.links?.twitter) {
        twitterSnippetPromise = this.getTwitterSnippet(collectionData.address, collectionData.links.twitter);
        promises.push(twitterSnippetPromise);
      }
      /**
       * pulled/updated concurrently
       */
      const results = await Promise.all(promises);

      for (const result of results) {
        if (result && collectionData) {
          if ('membersCount' in result) {
            collectionData.discordSnippet = result;
          } else if (result) {
            collectionData.twitterSnippet = result;
          }
        }
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
      error('Failed to get collection info for', slugOrAddress);
      error(err);
      res.sendStatus(StatusCode.InternalServerError);
    }
  }

  getHistoricalData(source: 'discord' | 'twitter') {
    return async (
      req: Request<
        { id: string },
        any,
        any,
        { from?: number; to?: number; interval?: 'hourly' | 'daily' | 'weekly'; startAt?: number }
      >,
      res: Response
    ) => {
      const interval = req.query.interval ?? 'hourly';
      const ONE_WEEK = ONE_DAY * 7;
      const address = req.params.id;

      let to;
      let from;
      let startAt;
      const limit = 100;

      type Data = DiscordHistoricalData | TwitterHistoricalData;

      let historicalData: Array<Record<keyof Data, number>> = [];
      const FOUR_WEEKS = 4 * ONE_WEEK;
      const EIGHT_WEEKS = 8 * ONE_WEEK;
      const maxRange = EIGHT_WEEKS;
      try {
        switch (interval) {
          case 'hourly':
            from = Number(req.query.from ?? Date.now() - ONE_WEEK);
            startAt = Number(req.query.startAt ?? from);
            to = Number(req.query.to ?? from + ONE_WEEK);
            if (to - startAt > maxRange) {
              to = startAt + maxRange;
            }
            historicalData = await this.fetchHistoricalData<Data>(source, address, startAt, to, limit, 'hourly');
            break;
          case 'daily':
            from = Number(req.query.from ?? Date.now() - FOUR_WEEKS);
            startAt = Number(req.query.startAt ?? from);
            to = Number(req.query.to ?? from + FOUR_WEEKS);
            if (to - startAt > maxRange) {
              to = startAt + maxRange;
            }
            historicalData = await this.fetchHistoricalData<Data>(source, address, startAt, to, limit, 'daily');
            break;
          case 'weekly':
            from = Number(req.query.from ?? Date.now() - EIGHT_WEEKS);
            startAt = Number(req.query.startAt ?? from);
            to = Number(req.query.to ?? from + EIGHT_WEEKS);
            if (to - startAt > maxRange) {
              to = startAt + maxRange;
            }
            historicalData = await this.fetchHistoricalData<Data>(source, address, startAt, to, limit, 'weekly');
            break;
          default:
            res.sendStatus(StatusCode.BadRequest);
            return;
        }

        historicalData.sort((itemA, itemB) => itemA.timestamp - itemB.timestamp);

        const respStr = jsonString(historicalData);
        // to enable cdn cache
        res.set({
          'Cache-Control': 'must-revalidate, max-age=60',
          'Content-Length': Buffer.byteLength(respStr, 'utf8')
        });
        res.send(respStr);
        return;
      } catch (err) {
        error('error occurred while getting historical twitter data');
        error(err);
        res.sendStatus(StatusCode.InternalServerError);
      }
    };
  }

  async fetchHistoricalData<Data extends WithTimestamp>(
    source: 'twitter' | 'discord',
    address: string,
    startAt: number,
    to: number,
    limit: number,
    interval: 'hourly' | 'daily' | 'weekly'
  ) {
    const historicalDocId = source;
    const historicalCollectionRef = firestore
      .collection(fstrCnstnts.ALL_COLLECTIONS_COLL)
      .doc(address)
      .collection('socials')
      .doc(historicalDocId)
      .collection('historical');
    let timestamp: number = Number(startAt);

    let dataPoints: Array<Record<keyof Data, number>> = [];
    let dataPointLimit = limit;
    const maxTimestamp = to > Date.now() ? Date.now() : to;
    while (dataPointLimit > 0 && timestamp < maxTimestamp) {
      console.log({ timestamp }, new Date(Number(timestamp)), typeof timestamp);

      const [year, week] = getWeekNumber(new Date(Number(timestamp)));
      console.log(year, week);

      const docId = firestore.getHistoricalDocId(year, week);
      const data = (await historicalCollectionRef.doc(docId).get()).data();
      if (data) {
        switch (interval) {
          case 'hourly':
            dataPoints = [...dataPoints, ...averageHistoricalData<Data>(data, 1)];
            break;
          case 'daily':
            dataPoints = [...dataPoints, ...averageHistoricalData<Data>(data, 24)];
            break;
          case 'weekly':
            dataPoints = [...dataPoints, ...averageHistoricalData<Data>(data, 168)];
        }
      }
      timestamp += ONE_DAY * 7;

      dataPointLimit = limit - dataPoints.length;
    }
    return dataPoints;
  }

  private async getLinksAndStats(collectionAddress?: string) {
    if (!collectionAddress) {
      return { links: undefined, stats: undefined };
    }

    const linkRef = firestore
      .collection(fstrCnstnts.ALL_COLLECTIONS_COLL)
      .doc(collectionAddress)
      .collection('socials')
      .doc('links');

    let links: Links | undefined = (await linkRef.get())?.data() as Links;

    links = await this.updateLinks(links, collectionAddress, false);

    const statsRef = firestore
      .collection(fstrCnstnts.ALL_COLLECTIONS_COLL)
      .doc(collectionAddress)
      .collection('stats')
      .doc('opensea');

    let stats: CollectionStats | undefined = (await statsRef.get())?.data() as CollectionStats;

    if (links?.slug) {
      stats = await this.updateStats(stats, collectionAddress, links.slug, false);
    }

    try {
      return {
        links,
        stats
      };
    } catch (err) {
      error('error occurred while getting collection links and stats');
      error(err);
    }
  }

  private async updateStats(stats: CollectionStats, collectionAddress: string, openseaSlug: string, force = false) {
    const now = new Date().getTime();

    const updatedAt = stats?.timestamp ? stats?.timestamp : 0;
    const shouldUpdate = now - updatedAt > MIN_COLLECTION_STATS_UPDATE_INTERVAL;

    try {
      if (shouldUpdate || force) {
        const updatedStats = await getCollectionStats(openseaSlug);

        if (updatedStats) {
          const statsRef = firestore
            .collection(fstrCnstnts.ALL_COLLECTIONS_COLL)
            .doc(collectionAddress)
            .collection('stats')
            .doc('opensea');

          void (await statsRef.set(
            {
              ...updatedStats
            },
            { merge: true }
          ));

          return updatedStats;
        }
      }
    } catch (err) {
      error('error occurred while updating stats');
      error(err);
    }

    return stats;
  }

  private async updateLinks(links: Links, collectionAddress: string, force = false) {
    const now = new Date().getTime();

    const updatedAt = links?.timestamp ? links?.timestamp : 0;
    const shouldUpdate = now - updatedAt > MIN_LINK_UPDATE_INTERVAL;

    try {
      if (shouldUpdate || force) {
        const updatedLinks = await getCollectionLinks(collectionAddress);
        if (updatedLinks) {
          const linkRef = firestore
            .collection(fstrCnstnts.ALL_COLLECTIONS_COLL)
            .doc(collectionAddress)
            .collection('socials')
            .doc('links');
          await linkRef.set(
            {
              ...updatedLinks
            },
            { merge: true }
          );

          return updatedLinks;
        }
      }
    } catch (err) {
      error('error occurred while updating links');
      error(err);
    }

    return links;
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
      const now = new Date().getTime();
      const updatedAt: number = typeof twitterSnippet?.timestamp === 'number' ? twitterSnippet?.timestamp : 0;
      if (force || (twitterLink && now - updatedAt > MIN_TWITTER_UPDATE_INTERVAL)) {
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

          const updatedTwitterSnippet: TwitterSnippet = {
            recentTweets: twitterData.tweets,
            timestamp: now,
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
          const docId = firestore.getHistoricalDocId(year, week);

          const hourOfTheWeek = `${date.getUTCDay() * 24 + date.getUTCHours()}`;

          const weekDocRef = twitterRef.collection('historical').doc(docId);

          /**
           * update historical data
           */
          batch.set(
            weekDocRef,
            {
              aggregated: { timestamp: now },
              [hourOfTheWeek]: { followersCount: twitterData.account?.followersCount, timestamp: now }
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
    } catch (err) {
      error(`error while updating twitter data for ${collectionAddress}`);
      error(err);
    }
    return twitterSnippet;
  }

  async getDiscordSnippet(collectionAddress: string, inviteLink: string) {
    if (!collectionAddress) {
      return;
    }
    try {
      const discordRef = firestore
        .collection(fstrCnstnts.ALL_COLLECTIONS_COLL)
        .doc(collectionAddress)
        .collection('socials')
        .doc('discord');
      let discordSnippet: DiscordSnippet = (await discordRef.get())?.data()?.discordSnippet;

      discordSnippet = await this.updateDiscordSnippet(discordSnippet, collectionAddress, inviteLink);

      return discordSnippet;
    } catch (err) {
      error('error occurred while getting disocrd snippet');
      error(err);
    }
  }

  async updateDiscordSnippet(
    discordSnippet: DiscordSnippet,
    collectionAddress: string,
    inviteLink: string,
    force = false
  ) {
    try {
      const now = new Date().getTime();

      const updatedAt: number = typeof discordSnippet?.timestamp === 'number' ? discordSnippet?.timestamp : 0;
      const shouldUpdate = now - updatedAt > MIN_DISCORD_UPDATE_INTERVAL;

      if (shouldUpdate || force) {
        const discord = new DiscordAPI();
        const res = await discord.getMembers(inviteLink);
        if (res) {
          const updatedSnippet: DiscordSnippet = {
            membersCount: res.members,
            presenceCount: res.presence,
            timestamp: new Date().getTime()
          };

          const batch = firestore.db.batch();

          const collectionInfoRef = firestore.collection(fstrCnstnts.ALL_COLLECTIONS_COLL).doc(collectionAddress);
          const discordRef = collectionInfoRef.collection('socials').doc('discord');

          /**
           * update collection info tweet snippet
           */
          batch.set(
            discordRef,
            {
              discordSnippet: updatedSnippet
            },
            { merge: true }
          );

          const date = new Date(now);
          const [year, week] = getWeekNumber(date);
          const docId = firestore.getHistoricalDocId(year, week);

          const hourOfTheWeek = `${date.getUTCDay() * 24 + date.getUTCHours()}`;

          const weekDocRef = discordRef.collection('historical').doc(docId);

          /**
           * update historical data
           */
          batch.set(
            weekDocRef,
            {
              aggregated: { timestamp: now },
              [hourOfTheWeek]: updatedSnippet
            },
            { merge: true }
          );

          // commit this batch so the updated data is available to aggregate the historical data
          await batch.commit();

          const batch2 = firestore.db.batch();

          const historicalRef = discordRef.collection('historical');

          const aggregated = await aggreagteHistorticalData<FollowerData, AggregatedFollowerData>(
            historicalRef,
            10,
            batch2
          );

          /**
           *  update snippet with aggregated data
           */
          batch2.set(
            discordRef,
            {
              discordSnippet: {
                ...updatedSnippet,
                aggregated
              }
            },
            { merge: true }
          );

          await batch2.commit();

          return {
            ...updatedSnippet
          };
        }
      }
    } catch (err) {
      error('error occurred while getting disocrd snippet');
      error(err);
    }

    return discordSnippet;
  }
}
