import { Collection, CreationFlow, StatsPeriod } from '@infinityxyz/lib/types/core';
import { firestoreConstants, getCollectionDocId } from '@infinityxyz/lib/utils';
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

  async getCollectionsStats(queryOptions: RequestCollectionsStatsDto) {
    const collectionGroup = this.firebaseService.firestore.collectionGroup('daily');
    switch (queryOptions.period) {
      case StatsPeriod.Daily:
      case StatsPeriod.All:
        break;

      default:
        throw new Error('not yet implemented');
    }

    const query = collectionGroup.orderBy(queryOptions.orderBy, queryOptions.orderDirection).limit(queryOptions.limit);

    const res = await query.get();
    const collectionStats = res.docs.map((snapShot) => {
      return snapShot.data();
    });

    return collectionStats;
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
