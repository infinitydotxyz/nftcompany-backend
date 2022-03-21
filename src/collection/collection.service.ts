import { Collection, CreationFlow, Stats } from '@infinityxyz/lib/types/core';
import { firestoreConstants, getCollectionDocId, getStatsDocInfo } from '@infinityxyz/lib/utils';
import { Injectable } from '@nestjs/common';
import { FirebaseService } from 'firebase/firebase.service';
import RequestCollectionsStatsDto from './dto/request-collections-stats.dto';

interface CollectionQueryOptions {
  /**
   * only show collections that have been fully indexed
   *
   * defaults to true
   */
  limitToCompleteCollections: boolean;
}

@Injectable()
export default class CollectionService {
  constructor(private firebaseService: FirebaseService) {}

  private get defaultCollectionQueryOptions(): CollectionQueryOptions {
    return {
      limitToCompleteCollections: true
    };
  }

  async getCollectionsStats(queryOptions: RequestCollectionsStatsDto): Promise<{ data: Stats[]; cursor: string }> {
    const collectionGroup = this.firebaseService.firestore.collectionGroup(firestoreConstants.COLLECTION_STATS_COLL);
    const date = queryOptions.date;
    const { timestamp } = getStatsDocInfo(date, queryOptions.period);

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
    }) as Stats[];

    const cursorInfo = collectionStats[collectionStats.length - 1];
    const cursor = `${cursorInfo.chainId}:${cursorInfo.collectionAddress}`;
    return { data: collectionStats, cursor };
  }

  /**
   * queries for a collection via address
   */
  async getCollectionByAddress(
    collection: { address: string; chainId: string },
    options?: CollectionQueryOptions
  ): Promise<Collection | undefined> {
    const queryOptions = options ?? this.defaultCollectionQueryOptions;
    const docId = getCollectionDocId({ collectionAddress: collection.address, chainId: collection.chainId });

    const collectionSnapshot = await this.firebaseService.firestore
      .collection(firestoreConstants.COLLECTIONS_COLL)
      .doc(docId)
      .get();

    const result = collectionSnapshot.data() as Collection | undefined;
    if (queryOptions.limitToCompleteCollections && result?.state?.create?.step !== CreationFlow.Complete) {
      return undefined;
    }

    return result;
  }

  /**
   * queries for a collection via slug
   */
  async getCollectionBySlug(
    collection: { slug: string; chainId: string },
    options?: CollectionQueryOptions
  ): Promise<Collection | undefined> {
    const queryOptions = options ?? this.defaultCollectionQueryOptions;

    let collectionQuery = this.firebaseService.firestore
      .collection(firestoreConstants.COLLECTIONS_COLL)
      .where('chainId', '==', collection.chainId)
      .where('slug', '==', collection.slug);

    if (queryOptions.limitToCompleteCollections) {
      collectionQuery = collectionQuery.where('state.create.step', '==', CreationFlow.Complete);
    }

    const collectionSnapshot = await collectionQuery.limit(1).get();

    return collectionSnapshot.docs?.[0]?.data() as Collection | undefined;
  }
}
