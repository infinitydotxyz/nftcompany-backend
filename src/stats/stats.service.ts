import { Collection, Stats, StatsPeriod } from '@infinityxyz/lib/types/core';
import { InfinityTweet, InfinityTwitterAccount } from '@infinityxyz/lib/types/services/twitter';
import { firestoreConstants, getStatsDocInfo } from '@infinityxyz/lib/utils';
import { Injectable, NotFoundException } from '@nestjs/common';
import { DiscordService } from '../discord/discord.service';
import { FirebaseService } from '../firebase/firebase.service';
import { TwitterService } from '../twitter/twitter.service';
import { calcPercentChange } from '../utils';
import StatsRequestDto, { StatType } from './dto/stats-request.dto';
import { CollectionStats } from './types/collection.stats.interface';
import { PreAggregatedSocialsStats, SocialsStats } from './types/socials.stats.interface';

@Injectable()
export class StatsService {
  private readonly socialsGroup = firestoreConstants.COLLECTION_SOCIALS_STATS_COLL;
  private readonly statsGroup = firestoreConstants.COLLECTION_STATS_COLL;

  constructor(
    private discordService: DiscordService,
    private twitterService: TwitterService,
    private firebaseService: FirebaseService
  ) {}

  async getStats(queryOptions: StatsRequestDto) {
    const primaryStatsCollectionName = this.getStatsCollectionName(queryOptions.orderBy);
    const secondaryStatsCollectionName =
      primaryStatsCollectionName === this.statsGroup ? this.socialsGroup : this.statsGroup;
    const timestamp = getStatsDocInfo(queryOptions.date, queryOptions.period).timestamp;

    const primaryStats = await this.getPrimaryStats(queryOptions, primaryStatsCollectionName);

    const secondaryStatsPromises = primaryStats.data.map(async (item) => {
      return new Promise((resolve, reject) => {
        const address = item.collectionAddress;
        const chainId = item.chainId;
        this.firebaseService
          .getCollectionRef({ address, chainId })
          .then((collectionRef) => {
            return this.getMostRecentStats(collectionRef, secondaryStatsCollectionName, queryOptions.period, timestamp);
          })
          .then((mostRecentStats) => {
            resolve(mostRecentStats);
          })
          .catch(reject);
      });
    });

    const secondaryStats = await Promise.allSettled(secondaryStatsPromises);

    const combinedStats = primaryStats.data.map((primary, index) => {
      const secondaryPromiseResult = secondaryStats[index];

      const secondary = secondaryPromiseResult.status === 'fulfilled' ? secondaryPromiseResult.value : undefined;
      const merged = this.mergeStats(primary, secondary);
      return merged;
    });

    return {
      data: combinedStats,
      cursor: primaryStats.cursor
    };
  }

  private mergeStats(
    primary: Partial<SocialsStats> & Partial<Stats>,
    secondary: Partial<SocialsStats> & Partial<Stats>
  ): CollectionStats {
    const mergeStat = (primary?: number, secondary?: number) => {
      if (typeof primary === 'number' && !Number.isNaN(primary)) {
        return primary;
      } else if (typeof secondary === 'number' && !Number.isNaN(secondary)) {
        return secondary;
      }

      return NaN;
    };

    const mergedStats: CollectionStats = {
      chainId: primary?.chainId ?? secondary?.chainId ?? '',
      collectionAddress: primary?.collectionAddress ?? secondary?.collectionAddress ?? '',
      tokenId: primary?.tokenId ?? secondary?.tokenId ?? '',
      floorPrice: mergeStat(primary?.floorPrice, secondary?.floorPrice),
      prevFloorPrice: mergeStat(primary?.prevFloorPrice, secondary?.prevFloorPrice),
      floorPricePercentChange: mergeStat(primary?.floorPricePercentChange, secondary?.floorPricePercentChange),
      ceilPrice: mergeStat(primary?.ceilPrice, secondary?.ceilPrice),
      prevCeilPrice: mergeStat(primary?.prevCeilPrice, secondary?.prevCeilPrice),
      ceilPricePercentChange: mergeStat(primary?.ceilPricePercentChange, secondary?.ceilPricePercentChange),
      volume: mergeStat(primary?.volume, secondary?.volume),
      prevVolume: mergeStat(primary?.prevVolume, secondary?.prevVolume),
      volumePercentChange: mergeStat(primary?.volumePercentChange, secondary?.volumePercentChange),
      numSales: mergeStat(primary?.numSales, secondary?.numSales),
      prevNumSales: mergeStat(primary?.prevNumSales, secondary?.prevNumSales),
      numSalesPercentChange: mergeStat(primary?.numSalesPercentChange, secondary?.numSalesPercentChange),
      avgPrice: mergeStat(primary?.avgPrice, secondary?.avgPrice),
      avgPricePercentChange: mergeStat(primary?.avgPricePercentChange, secondary?.avgPricePercentChange),
      prevAvgPrice: mergeStat(primary?.prevAvgPrice, secondary?.prevAvgPrice),
      prevDiscordFollowers: mergeStat(primary?.prevDiscordFollowers, secondary?.prevDiscordFollowers),
      discordFollowersPercentChange: mergeStat(
        primary?.discordFollowersPercentChange,
        secondary?.discordFollowersPercentChange
      ),
      discordFollowers: mergeStat(primary?.discordFollowers, secondary?.discordFollowers),
      discordPresence: mergeStat(primary?.discordPresence, secondary?.discordPresence),
      prevDiscordPresence: mergeStat(primary?.prevDiscordPresence, secondary?.prevDiscordPresence),
      discordPresencePercentChange: mergeStat(
        primary?.discordPresencePercentChange,
        secondary?.discordPresencePercentChange
      ),
      prevTwitterFollowers: mergeStat(primary?.prevTwitterFollowers, secondary?.prevTwitterFollowers),
      twitterFollowersPercentChange: mergeStat(
        primary?.twitterFollowersPercentChange,
        secondary?.twitterFollowersPercentChange
      ),
      twitterFollowers: mergeStat(primary?.twitterFollowers, secondary?.twitterFollowers),
      twitterFollowing: mergeStat(primary?.twitterFollowing, secondary?.twitterFollowing),
      prevTwitterFollowing: mergeStat(primary?.prevTwitterFollowing, secondary?.prevTwitterFollowing),
      twitterFollowingPercentChange: mergeStat(
        primary?.twitterFollowingPercentChange,
        secondary?.twitterFollowingPercentChange
      ),
      guildId: primary?.guildId ?? secondary?.guildId ?? '',
      discordLink: primary?.discordLink ?? secondary?.discordLink ?? '',
      twitterId: primary?.twitterId ?? secondary?.twitterId ?? '',
      twitterHandle: primary?.twitterHandle ?? secondary?.twitterHandle ?? '',
      twitterLink: primary?.twitterLink ?? secondary?.twitterLink ?? '',
      updatedAt: primary?.updatedAt ?? NaN,
      timestamp: primary?.timestamp ?? secondary?.timestamp ?? NaN,
      period: primary?.period ?? secondary?.period
    };

    return mergedStats;
  }

  async getPrimaryStats(queryOptions: StatsRequestDto, statsGroupName: string) {
    const date = queryOptions.date;
    const { timestamp } = getStatsDocInfo(date, queryOptions.period);
    const collectionGroup = this.firebaseService.firestore.collectionGroup(statsGroupName);

    let startAfter;
    if (queryOptions.cursor) {
      const [chainId, address] = queryOptions.cursor.split(':');
      const startAfterDocResults = await collectionGroup
        .where('period', '==', queryOptions.period)
        .where('timestamp', '==', timestamp)
        .where('collectionAddress', '==', address)
        .where('chainId', '==', chainId)
        .limit(1)
        .get();
      startAfter = startAfterDocResults.docs[0];
    }

    let query = collectionGroup
      .where('timestamp', '==', timestamp)
      .where('period', '==', queryOptions.period)
      .orderBy(queryOptions.orderBy, queryOptions.orderDirection)
      .orderBy('collectionAddress', 'asc');
    if (startAfter) {
      query = query.startAfter(startAfter);
    }

    query = query.limit(queryOptions.limit);

    const res = await query.get();
    const collectionStats = res.docs.map((snapShot) => {
      return snapShot.data();
    }) as Stats[] | SocialsStats[];

    const cursorInfo = collectionStats[collectionStats.length - 1];
    let cursor = '';
    if (cursorInfo?.chainId && cursorInfo?.collectionAddress) {
      cursor = `${cursorInfo.chainId}:${cursorInfo.collectionAddress}`;
    }
    return { data: collectionStats, cursor };
  }

  async getMostRecentStats(
    collectionRef: FirebaseFirestore.DocumentReference,
    statsCollectionName: string,
    period: StatsPeriod,
    date: number
  ) {
    try {
      const timestamp = getStatsDocInfo(date, period).timestamp;
      const statsQuery = collectionRef
        .collection(statsCollectionName)
        .where('period', '==', period)
        .where('timestamp', '<=', timestamp)
        .orderBy('timestamp', 'desc')
        .limit(1);
      const snapshot = await statsQuery.get();
      const stats = snapshot.docs?.[0]?.data();
      return stats as Stats | SocialsStats | undefined;
    } catch (err) {
      console.error(err);
      return undefined;
    }
  }

  /**
   * get the current stats and update them if they are stale
   */
  async getCurrentSocialsStats(collectionRef: FirebaseFirestore.DocumentReference) {
    const mostRecentSocialStats = await this.getMostRecentSocialsStats(collectionRef, StatsPeriod.All);
    if (this.areStatsStale(mostRecentSocialStats)) {
      const updated = await this.updateSocialsStats(collectionRef);
      if (updated) {
        return updated;
      }
    }

    return mostRecentSocialStats;
  }

  private async updateSocialsStats(collectionRef: FirebaseFirestore.DocumentReference): Promise<SocialsStats> {
    const collectionData = await collectionRef.get();
    const collection = collectionData?.data() ?? ({} as Partial<Collection>);

    if (!collection.address || !collection.chainId) {
      throw new NotFoundException(
        `Failed to find a collection with address: ${collection.address} and chainId: ${collection.chainId}`
      );
    }

    let discordPromise = new Promise<
      | undefined
      | {
          discordFollowers: number;
          discordPresence: number;
          guildId: string;
          link: string;
        }
    >((res) => res(undefined));

    let twitterPromise = new Promise<
      | undefined
      | {
          account: InfinityTwitterAccount;
          tweets: InfinityTweet[];
        }
    >((res) => res(undefined));

    if (collection?.metadata?.links?.discord) {
      discordPromise = this.discordService.getGuildStats(collection.metadata.links.discord);
    }

    if (collection?.metadata?.links?.twitter) {
      const username = TwitterService.extractTwitterUsername(collection.metadata.links.twitter);
      twitterPromise = this.twitterService.getAccountAndMentions(username);
    }

    const [discordPromiseResult, twitterPromiseResult] = await Promise.allSettled([discordPromise, twitterPromise]);
    const discordResponse = discordPromiseResult.status === 'fulfilled' ? discordPromiseResult.value : undefined;
    const twitterResponse = twitterPromiseResult.status === 'fulfilled' ? twitterPromiseResult.value : undefined;

    if (twitterResponse?.tweets?.length) {
      void this.twitterService.saveMentions(collectionRef, twitterResponse?.tweets);
    }

    const discordStats: Pick<
      PreAggregatedSocialsStats,
      'discordFollowers' | 'discordPresence' | 'guildId' | 'discordLink'
    > = {
      discordFollowers: discordResponse?.discordFollowers ?? NaN,
      discordPresence: discordResponse?.discordPresence ?? NaN,
      guildId: discordResponse?.guildId ?? '',
      discordLink: discordResponse?.link ?? ''
    };

    const twitterStats: Pick<
      PreAggregatedSocialsStats,
      'twitterFollowers' | 'twitterFollowing' | 'twitterId' | 'twitterHandle' | 'twitterLink'
    > = {
      twitterFollowers: twitterResponse?.account?.followersCount ?? NaN,
      twitterFollowing: twitterResponse?.account?.followingCount ?? NaN,
      twitterId: twitterResponse?.account?.id ?? '',
      twitterHandle: twitterResponse?.account?.username ?? '',
      twitterLink: TwitterService.appendTwitterUsername(twitterResponse?.account?.username ?? '')
    };

    const socialsStats: PreAggregatedSocialsStats = {
      collectionAddress: collection.address,
      chainId: collection.chainId,
      ...discordStats,
      ...twitterStats,
      updatedAt: Date.now()
    };

    const allTimeStats = await this.saveSocialsStats(collectionRef, socialsStats);
    return allTimeStats;
  }

  private async saveSocialsStats(
    collectionRef: FirebaseFirestore.DocumentReference,
    preAggregatedStats: PreAggregatedSocialsStats
  ): Promise<SocialsStats> {
    const socialsCollection = collectionRef.collection(firestoreConstants.COLLECTION_SOCIALS_STATS_COLL);
    const aggregatedStats = await this.aggregateSocialsStats(collectionRef, preAggregatedStats);

    const batch = this.firebaseService.firestore.batch();
    for (const [, stats] of Object.entries(aggregatedStats)) {
      const { docId } = getStatsDocInfo(stats.timestamp, stats.period);
      const docRef = socialsCollection.doc(docId);
      batch.set(docRef, stats, { merge: true });
    }
    await batch.commit();

    return aggregatedStats.all;
  }

  private async aggregateSocialsStats(
    collectionRef: FirebaseFirestore.DocumentReference,
    currentStats: PreAggregatedSocialsStats
  ): Promise<Record<StatsPeriod, SocialsStats>> {
    /**
     * get the most recent stats for each period and store them in a map with the period as the key and the stats as the value
     */
    const statsPeriods = [
      StatsPeriod.Hourly,
      StatsPeriod.Daily,
      StatsPeriod.Weekly,
      StatsPeriod.Monthly,
      StatsPeriod.Yearly,
      StatsPeriod.All
    ];

    const mostRecentStats = statsPeriods.map((period) => this.getMostRecentSocialsStats(collectionRef, period));
    const mostRecentStatsResponse = await Promise.all(mostRecentStats);

    const socialsStatsMap: Record<StatsPeriod, SocialsStats | undefined> = {} as any;
    statsPeriods.forEach((period, index) => {
      socialsStatsMap[period] = mostRecentStatsResponse[index];
    });

    const aggregatedStats: Record<StatsPeriod, SocialsStats> = {} as any;
    for (const [period, prevStats] of Object.entries(socialsStatsMap)) {
      const info = getStatsDocInfo(currentStats.updatedAt, period as StatsPeriod);
      const prevDiscordFollowers = prevStats?.discordFollowers ?? currentStats.discordFollowers;
      const discordFollowersPercentChange = calcPercentChange(prevDiscordFollowers, currentStats.discordFollowers);
      const prevDiscordPresence = prevStats?.discordPresence ?? currentStats.discordPresence;
      const discordPresencePercentChange = calcPercentChange(prevDiscordPresence, currentStats.discordPresence);
      const prevTwitterFollowers = prevStats?.twitterFollowers ?? currentStats.twitterFollowers;
      const twitterFollowersPercentChange = calcPercentChange(prevTwitterFollowers, currentStats.twitterFollowers);
      const prevTwitterFollowing = prevStats?.twitterFollowing ?? currentStats.twitterFollowing;
      const twitterFollowingPercentChange = calcPercentChange(prevTwitterFollowing, currentStats.twitterFollowing);

      const stats: SocialsStats = {
        ...currentStats,
        timestamp: info.timestamp,
        prevDiscordFollowers,
        discordFollowersPercentChange,
        prevDiscordPresence,
        discordPresencePercentChange,
        prevTwitterFollowers,
        twitterFollowersPercentChange,
        prevTwitterFollowing,
        twitterFollowingPercentChange,
        period: period as StatsPeriod
      };

      aggregatedStats[period] = stats;
    }

    return aggregatedStats;
  }

  private areStatsStale(stats: Partial<SocialsStats> | undefined): boolean {
    const updatedAt = stats?.timestamp ?? 0;
    const { timestamp } = getStatsDocInfo(updatedAt, StatsPeriod.Hourly);
    const { timestamp: current } = getStatsDocInfo(Date.now(), StatsPeriod.Hourly);
    return timestamp !== current;
  }

  private async getMostRecentSocialsStats(collectionRef: FirebaseFirestore.DocumentReference, period: StatsPeriod) {
    const socialStatsQuery = collectionRef
      .collection(firestoreConstants.COLLECTION_SOCIALS_STATS_COLL)
      .where('period', '==', period)
      .orderBy('timestamp', 'desc')
      .limit(1);
    const snapshot = await socialStatsQuery.get();
    const stats = snapshot.docs?.[0]?.data();
    return stats as SocialsStats | undefined;
  }

  private getStatsCollectionName(statType: StatType) {
    const socialsStats = [
      StatType.DiscordFollowers,
      StatType.DiscordFollowersPercentChange,
      StatType.DiscordPresence,
      StatType.DiscordPresencePercentChange,
      StatType.TwitterFollowers,
      StatType.TwitterFollowersPercentChange
    ];
    const collectionGroupName = socialsStats.includes(statType) ? this.socialsGroup : this.statsGroup;
    return collectionGroupName;
  }
}
