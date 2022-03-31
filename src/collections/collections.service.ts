import { Collection, CreationFlow } from '@infinityxyz/lib/types/core';
import { firestoreConstants, getCollectionDocId, getEndCode, getSearchFriendlyString } from '@infinityxyz/lib/utils';
import { Injectable } from '@nestjs/common';
import { FirebaseService } from 'firebase/firebase.service';
import { base64Decode, base64Encode } from 'utils';
import { CollectionSearchQueryDto } from './dto/collection-search-query.dto';

interface CollectionQueryOptions {
  /**
   * Only show collections that have been fully indexed
   *
   * defaults to true
   */
  limitToCompleteCollections: boolean;
}

@Injectable()
export default class CollectionsService {
  constructor(private firebaseService: FirebaseService) {}

  private get defaultCollectionQueryOptions(): CollectionQueryOptions {
    return {
      limitToCompleteCollections: true
    };
  }

  async searchByName(search: CollectionSearchQueryDto) {
    const startsWith = getSearchFriendlyString(search.query);
    const decodedCursor = search.cursor ? base64Decode(search.cursor) : '';

    const endCode = getEndCode(startsWith);

    let firestoreQuery = await this.firebaseService.firestore
      .collection(firestoreConstants.COLLECTIONS_COLL)
      .where('slug', '>=', startsWith)
      .where('slug', '<', endCode)
      .orderBy('slug');

    if (decodedCursor) {
      firestoreQuery = firestoreQuery.startAfter(decodedCursor);
    }

    const snapshot = await firestoreQuery
      .select('address', 'chainId', 'slug', 'metadata.name', 'hasBlueCheck')
      .limit(search.limit + 1) // +1 to check if there are more results
      .get();

    const collections = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        address: data.address as string,
        chainId: data.chainId as string,
        slug: data.slug as string,
        name: data.metadata.name as string,
        hasBlueCheck: data.hasBlueCheck as boolean
      };
    });

    const hasNextPage = collections.length > search.limit;
    if (hasNextPage) {
      collections.pop(); // Remove item used to check if there are more results
    }
    const cursor = base64Encode(collections?.[collections?.length - 1]?.slug ?? ''); // Must be after we pop the item used for pagination

    return {
      data: collections,
      cursor,
      hasNextPage
    };
  }

  /**
   * Queries for a collection via address
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
}
