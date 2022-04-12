import { Collection, CollectionMetadata, CreationFlow } from '@infinityxyz/lib/types/core';
import { firestoreConstants, getCollectionDocId, getEndCode, getSearchFriendlyString } from '@infinityxyz/lib/utils';
import { Injectable } from '@nestjs/common';
import { FirebaseService } from 'firebase/firebase.service';
import { CollectionSearchQueryDto } from './dto/collection-search-query.dto';
import { base64Encode, base64Decode } from 'utils';
import { ParsedCollectionId } from './collection-id.pipe';

interface CollectionQueryOptions {
  /**
   * Only show collections that have been fully indexed
   *
   * Defaults to `true`.
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
    let firestoreQuery: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
      this.firebaseService.firestore.collection(firestoreConstants.COLLECTIONS_COLL);

    if (search.query) {
      const startsWith = getSearchFriendlyString(search.query);
      const endCode = getEndCode(startsWith);

      if (startsWith && endCode) {
        firestoreQuery = firestoreQuery.where('slug', '>=', startsWith).where('slug', '<', endCode);
      }
    }

    firestoreQuery = firestoreQuery.orderBy('slug');

    const decodedCursor = search.cursor ? base64Decode(search.cursor) : '';
    if (decodedCursor) {
      firestoreQuery = firestoreQuery.startAfter(decodedCursor);
    }

    const snapshot = await firestoreQuery
      .select(
        'address',
        'chainId',
        'slug',
        'metadata.name',
        'metadata.profileImage',
        'metadata.description',
        'hasBlueCheck'
      )
      .limit(search.limit + 1) // +1 to check if there are more results
      .get();

    const collections = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        address: data.address as string,
        chainId: data.chainId as string,
        slug: data.slug as string,
        name: data.metadata.name as string,
        hasBlueCheck: data.hasBlueCheck as boolean,
        profileImage: data.metadata.profileImage as string,
        description: data.metadata.description as string
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

  async setCollectionMetadata(collection: ParsedCollectionId, metadata: CollectionMetadata) {
    await collection.ref.set({ metadata }, { merge: true });
  }

  /**
   * Verify whether the given user address is the deployer/creator of the collection.
   */
  async isDeployer(userAddress: string, { ref }: ParsedCollectionId) {
    const document = await ref.get();
    const data = document.data();
    return userAddress === data.deployer;
  }

  /**
   * Verify whether the given user address is an editor of the collection.
   */
  async isEditor(userAddress: string, { ref }: ParsedCollectionId) {
    const editorsDocRef = ref.collection(firestoreConstants.AUTH_COLL).doc(firestoreConstants.EDITORS_DOC);
    const document = await editorsDocRef.get();
    const data = document.data();

    return data?.[userAddress]?.authorized;
  }

  /**
   * Verify whether the given user address is an administrator of the infnity platform.
   */
  async isAdmin(userAddress: string) {
    const adminDocRef = this.firebaseService.firestore
      .collection(firestoreConstants.AUTH_COLL)
      .doc(firestoreConstants.ADMINS_DOC);
    const document = await adminDocRef.get();
    const data = document.data();
    return data?.[userAddress]?.authorized;
  }

  /**
   * Verify whether the given user address can modify the collection.
   */
  async canModify(userAddress: string, parsedCollection: ParsedCollectionId) {
    return (
      (await this.isDeployer(userAddress, parsedCollection)) ||
      (await this.isEditor(userAddress, parsedCollection)) ||
      (await this.isAdmin(userAddress))
    );
  }
}
