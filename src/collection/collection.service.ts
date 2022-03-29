import { Collection, CreationFlow } from '@infinityxyz/lib/types/core';
import { firestoreConstants, getCollectionDocId } from '@infinityxyz/lib/utils';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CollectionViaSlugDto } from 'firebase/dto/collection-ref.dto';
import { FirebaseService } from 'firebase/firebase.service';
import { CollectionQueryDto } from './dto/collection-query.dto';

interface CollectionQueryOptions {
  /**
   * Only show collections that have been fully indexed
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

  async getCollectionBySlugOrAddress(query: CollectionQueryDto): Promise<Collection> {
    let collection: Collection | undefined;
    if (query?.slug) {
      collection = await this.getCollectionBySlug({ slug: query.slug });
    } else if (query?.address && query?.chainId) {
      collection = await this.getCollectionByAddress({ address: query.address, chainId: query.chainId });
    } else {
      throw new BadRequestException('Failed to pass address or slug');
    }

    if (!collection) {
      throw new NotFoundException(
        `Failed to find collection with slug: ${query.slug} address: ${query.address} chainId: ${query.chainId}`
      );
    }

    return collection;
  }

  /**
   * Queries for a collection via address
   */
  private async getCollectionByAddress(
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
   * Queries for a collection via slug
   */
  private async getCollectionBySlug(
    collection: CollectionViaSlugDto,
    options?: CollectionQueryOptions
  ): Promise<Collection | undefined> {
    const queryOptions = options ?? this.defaultCollectionQueryOptions;

    let collectionQuery = this.firebaseService.firestore
      .collection(firestoreConstants.COLLECTIONS_COLL)
      .where('slug', '==', collection.slug);

    if (queryOptions.limitToCompleteCollections) {
      collectionQuery = collectionQuery.where('state.create.step', '==', CreationFlow.Complete);
    }

    const collectionSnapshot = await collectionQuery.limit(1).get();

    return collectionSnapshot.docs?.[0]?.data() as Collection | undefined;
  }
}
