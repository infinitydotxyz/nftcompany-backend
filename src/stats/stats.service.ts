import {
  ChainId,
  Collection,
  OrderDirection,
  PreAggregatedSocialsStats,
  SocialsStats,
  Stats,
  StatsPeriod,
  StatType
} from '@infinityxyz/lib/types/core';
import { InfinityTweet, InfinityTwitterAccount } from '@infinityxyz/lib/types/services/twitter';
import { firestoreConstants, getStatsDocInfo } from '@infinityxyz/lib/utils';
import { Injectable } from '@nestjs/common';
import { ParsedCollectionId } from 'collections/collection-id.pipe';
import { CollectionHistoricalStatsQueryDto } from 'collections/dto/collection-historical-stats-query.dto';
import { CollectionStatsByPeriodDto } from 'collections/dto/collection-stats-by-period.dto';
import RankingsRequestDto from 'collections/dto/rankings-query.dto';
import { VotesService } from 'votes/votes.service';
import { DiscordService } from '../discord/discord.service';
import { FirebaseService } from '../firebase/firebase.service';
import { TwitterService } from '../twitter/twitter.service';
import { base64Decode, base64Encode, calcPercentChange } from '../utils';
import { CollectionStatsArrayResponseDto } from './dto/collection-stats-array.dto';
import { CollectionStatsDto } from './dto/collection-stats.dto';

@Injectable()
export class StatsService {
  private readonly socialsGroup = firestoreConstants.COLLECTION_SOCIALS_STATS_COLL;
  private readonly statsGroup = firestoreConstants.COLLECTION_STATS_COLL;

  private socialsStats = [
    StatType.DiscordFollowers,
    StatType.DiscordFollowersPercentChange,
    StatType.DiscordPresence,
    StatType.DiscordPresencePercentChange,
    StatType.TwitterFollowers,
    StatType.TwitterFollowersPercentChange
  ];

  constructor(
    private discordService: DiscordService,
    private twitterService: TwitterService,
    private firebaseService: FirebaseService,
    private votesService: VotesService
  ) {}

  async getCollectionRankings(queryOptions: RankingsRequestDto): Promise<CollectionStatsArrayResponseDto> {
    const { primary: primaryStatsCollectionName, secondary: secondaryStatsCollectionName } =
      this.getStatsCollectionNames(queryOptions.orderBy);

    const query = {
      ...queryOptions,
      limit: queryOptions.limit + 1 // +1 to check if there are more results
    };

    const primaryStats = await this.getPrimaryStats(query, primaryStatsCollectionName);
    const timestamp = getStatsDocInfo(queryOptions.date, queryOptions.period).timestamp;
    const secondaryStatsPromises = primaryStats.data.map(async (primaryStat) => {
      return this.getSecondaryStats(primaryStat, secondaryStatsCollectionName, query.period, timestamp);
    });

    const secondaryStats = await Promise.allSettled(secondaryStatsPromises);

    const combinedStats = await Promise.all(
      primaryStats.data.map(async (primary, index) => {
        const secondaryPromiseResult = secondaryStats[index];

        const secondary = secondaryPromiseResult.status === 'fulfilled' ? secondaryPromiseResult.value : undefined;

        const collection = { address: primary?.collectionAddress, chainId: primary?.chainId as ChainId };
        const merged = await this.mergeStats(primary, secondary, collection);
        return merged;
      })
    );

    const hasNextPage = combinedStats.length > queryOptions.limit;
    if (hasNextPage) {
      combinedStats.pop(); // Remove the item that was added to check if there are more results
    }

    return {
      data: combinedStats,
      cursor: primaryStats.cursor,
      hasNextPage
    };
  }

  async getCollectionStatsByPeriodAndDate(
    collection: ParsedCollectionId,
    date: number,
    periods: StatsPeriod[]
  ): Promise<CollectionStatsByPeriodDto> {
    const getQuery = (period: StatsPeriod) => {
      const query: CollectionHistoricalStatsQueryDto = {
        period,
        orderDirection: OrderDirection.Descending,
        limit: 1,
        maxDate: date,
        minDate: 0
      };
      return query;
    };

    const queries = periods.map((period) => getQuery(period));

    const responses = await Promise.all(queries.map((query) => this.getCollectionHistoricalStats(collection, query)));

    const statsByPeriod: CollectionStatsByPeriodDto = responses.reduce(
      (acc: Record<StatsPeriod, CollectionStatsDto>, statResponse) => {
        const period = statResponse?.data?.[0]?.period;
        if (period) {
          return {
            ...acc,
            [period]: statResponse.data[0]
          };
        }
        return acc;
      },
      {} as any
    );

    return statsByPeriod;
  }

  async getCollectionHistoricalStats(
    collection: ParsedCollectionId,
    query: CollectionHistoricalStatsQueryDto
  ): Promise<CollectionStatsArrayResponseDto> {
    const startAfterCursorStr = base64Decode(query.cursor);
    const startAfterCursor = startAfterCursorStr ? parseInt(startAfterCursorStr, 10) : '';
    const orderDirection = query.orderDirection;
    const limit = query.limit;
    const period = query.period;

    let statsQuery = collection.ref
      .collection(this.statsGroup)
      .where('period', '==', period)
      .where('timestamp', '<=', query.maxDate)
      .where('timestamp', '>=', query.minDate)
      .orderBy('timestamp', orderDirection);
    if (typeof startAfterCursor === 'number' && !Number.isNaN(startAfterCursor)) {
      statsQuery = statsQuery.startAfter(startAfterCursor);
    }
    statsQuery = statsQuery.limit(limit + 1); // +1 to check if there are more results

    const stats = (await statsQuery.get()).docs.map((item) => item.data()) as Stats[];
    const secondaryStatsPromises = stats.map(async (primaryStat) => {
      return this.getSecondaryStats(primaryStat, this.socialsGroup, query.period, primaryStat.timestamp);
    });

    const secondaryStats = await Promise.allSettled(secondaryStatsPromises);

    const combinedStats = await Promise.all(
      stats.map(async (primary, index) => {
        const secondaryPromiseResult = secondaryStats[index];

        const secondary = secondaryPromiseResult.status === 'fulfilled' ? secondaryPromiseResult.value : undefined;

        const collection = { address: primary?.collectionAddress, chainId: primary?.chainId };
        const merged = await this.mergeStats(primary, secondary, {
          chainId: collection.chainId as ChainId,
          address: collection.address
        });
        return merged;
      })
    );

    const hasNextPage = combinedStats.length > limit;
    if (hasNextPage) {
      combinedStats.pop(); // Remove the item that was added to check if there are more results
    }
    const cursorTimestamp = combinedStats?.[combinedStats?.length - 1]?.timestamp;
    const cursor = base64Encode(cursorTimestamp ? `${cursorTimestamp}` : '');

    return {
      data: combinedStats,
      cursor,
      hasNextPage
    };
  }

  async getCollectionStats(
    collection: { address: string; chainId: ChainId },
    options: { period: StatsPeriod; date: number }
  ) {
    const collectionRef = await this.firebaseService.getCollectionRef(collection);
    const stats = await this.getCollectionStatsForPeriod(
      collectionRef,
      this.statsGroup,
      options.period,
      options.date,
      true
    );
    const socialStats = await this.getCollectionStatsForPeriod(
      collectionRef,
      this.socialsGroup,
      options.period,
      options.date,
      true
    );

    if (stats && socialStats) {
      const collectionStats = await this.mergeStats(stats, socialStats, collection);
      return collectionStats;
    }

    return new CollectionStatsDto();
  }

  private async getSecondaryStats(
    primaryStat: Stats | SocialsStats,
    secondaryStatsCollectionName: string,
    period: StatsPeriod,
    timestamp: number
  ) {
    const address = primaryStat.collectionAddress;
    const chainId = primaryStat.chainId as ChainId;
    const collectionRef = await this.firebaseService.getCollectionRef({ address, chainId });
    const mostRecentStats = await this.getCollectionStatsForPeriod(
      collectionRef,
      secondaryStatsCollectionName,
      period,
      timestamp,
      false
    );
    return mostRecentStats;
  }

  private async mergeStats(
    primary: (Partial<SocialsStats> & Partial<Stats>) | undefined,
    secondary: (Partial<SocialsStats> & Partial<Stats>) | undefined,
    collection: { chainId: ChainId; address: string }
  ): Promise<CollectionStatsDto> {
    const mergeStat = (primary?: number, secondary?: number) => {
      if (typeof primary === 'number' && !Number.isNaN(primary)) {
        return primary;
      } else if (typeof secondary === 'number' && !Number.isNaN(secondary)) {
        return secondary;
      }

      return NaN;
    };

    const ref = await this.firebaseService.getCollectionRef(collection);

    const votesPromise = this.votesService.getCollectionVotes({
      ...collection,
      ref
    });
    const collectionPromise = ref.get();

    const [collectionResult, votesResult] = await Promise.allSettled([collectionPromise, votesPromise]);
    const collectionData = collectionResult.status === 'fulfilled' ? collectionResult.value.data() : {};
    const votes = votesResult.status === 'fulfilled' ? votesResult.value : { votesFor: NaN, votesAgainst: NaN };

    const name = collectionData?.metadata?.name ?? 'Unknown';
    const profileImage = collectionData?.metadata?.profileImage ?? '';
    const numOwners = collectionData?.numOwners ?? NaN;
    const numNfts = collectionData?.numNfts ?? NaN;
    const hasBlueCheck = collectionData?.hasBlueCheck ?? false;

    const mergedStats: CollectionStatsDto = {
      name,
      profileImage,
      numOwners,
      numNfts,
      hasBlueCheck,
      chainId: collection.chainId,
      collectionAddress: collection.address,
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
      period: primary?.period ?? secondary?.period ?? StatsPeriod.All,
      votesFor: votes?.votesFor ?? NaN,
      votesAgainst: votes?.votesAgainst ?? NaN
    };

    return mergedStats;
  }

  async getPrimaryStats(queryOptions: RankingsRequestDto, statsGroupName: string) {
    const date = queryOptions.date;
    const { timestamp } = getStatsDocInfo(date, queryOptions.period);
    const collectionGroup = this.firebaseService.firestore.collectionGroup(statsGroupName);

    let startAfter;
    if (queryOptions.cursor) {
      const decodedCursor = base64Decode(queryOptions.cursor);
      const [chainId, address] = decodedCursor.split(':');
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
      cursor = base64Encode(`${cursorInfo.chainId}:${cursorInfo.collectionAddress}`);
    }
    return { data: collectionStats, cursor };
  }

  async getCollectionStatsForPeriod(
    collectionRef: FirebaseFirestore.DocumentReference,
    statsCollectionName: string,
    period: StatsPeriod,
    timestamp: number,
    waitForUpdate = false
  ) {
    try {
      const statsQuery = collectionRef
        .collection(statsCollectionName)
        .where('period', '==', period)
        .where('timestamp', '<=', timestamp)
        .orderBy('timestamp', 'desc')
        .limit(1);
      const snapshot = await statsQuery.get();
      const stats = snapshot.docs?.[0]?.data();
      const requestedTimestamp = getStatsDocInfo(timestamp, period).timestamp;
      const currentTimestamp = getStatsDocInfo(Date.now(), period).timestamp;
      const isMostRecent = requestedTimestamp === currentTimestamp;
      /**
       * Attempt to update socials stats if they're out of date
       */
      if (isMostRecent && statsCollectionName === this.socialsGroup) {
        if (this.areStatsStale(stats)) {
          if (waitForUpdate) {
            const updated = await this.updateSocialsStats(collectionRef);
            if (updated) {
              return updated;
            }
          } else {
            void this.updateSocialsStats(collectionRef);
          }
        }
      }

      return stats as Stats | SocialsStats | undefined;
    } catch (err: any) {
      console.error(err);
      return undefined;
    }
  }

  /**
   * Get the current stats and update them if they are stale
   */
  async getCurrentSocialsStats(collectionRef: FirebaseFirestore.DocumentReference, waitForUpdate = false) {
    const mostRecentSocialStats = await this.getMostRecentSocialsStats(collectionRef, StatsPeriod.All);
    if (this.areStatsStale(mostRecentSocialStats)) {
      if (waitForUpdate) {
        const updated = await this.updateSocialsStats(collectionRef);
        if (updated) {
          return updated;
        }
      } else {
        void this.updateSocialsStats(collectionRef);
      }
    }

    return mostRecentSocialStats;
  }

  private async updateSocialsStats(
    collectionRef: FirebaseFirestore.DocumentReference
  ): Promise<SocialsStats | undefined> {
    const collectionData = await collectionRef.get();
    const collection = collectionData?.data() ?? ({} as Partial<Collection>);

    let address = collection.address;
    let chainId = collection.chainId;
    if (!address || !chainId) {
      const collectionId = collectionRef.id;
      const [parsedChainId, parsedAddress] = collectionId.split(':');
      address = parsedAddress;
      chainId = parsedChainId;
      if (!address || !chainId) {
        return;
      }
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
      void this.twitterService.saveCollectionMentions(collectionRef, twitterResponse?.tweets);
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
      twitterLink: twitterResponse?.account?.username
        ? TwitterService.appendTwitterUsername(twitterResponse.account.username)
        : ''
    };

    const socialsStats: PreAggregatedSocialsStats = {
      collectionAddress: address,
      chainId: chainId,
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
     * Get the most recent stats for each period and store them in a map with the period as the key and the stats as the value
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
    for (const [period, prevStats] of Object.entries(socialsStatsMap) as [StatsPeriod, SocialsStats | undefined][]) {
      const info = getStatsDocInfo(currentStats.updatedAt, period);
      const prevDiscordFollowers = prevStats?.discordFollowers || currentStats.discordFollowers;
      const discordFollowersPercentChange = calcPercentChange(prevDiscordFollowers, currentStats.discordFollowers);
      const prevDiscordPresence = prevStats?.discordPresence || currentStats.discordPresence;
      const discordPresencePercentChange = calcPercentChange(prevDiscordPresence, currentStats.discordPresence);
      const prevTwitterFollowers = prevStats?.twitterFollowers || currentStats.twitterFollowers;
      const twitterFollowersPercentChange = calcPercentChange(prevTwitterFollowers, currentStats.twitterFollowers);
      const prevTwitterFollowing = prevStats?.twitterFollowing || currentStats.twitterFollowing;
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
        period: period
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

  private getStatsCollectionNames(statType: StatType) {
    const collectionGroupNames = this.socialsStats.includes(statType)
      ? { primary: this.socialsGroup, secondary: this.statsGroup }
      : { primary: this.statsGroup, secondary: this.socialsGroup };
    return collectionGroupNames;
  }
}
