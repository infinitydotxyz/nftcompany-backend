import { Collection } from '@infinityxyz/lib/types/core';
import { firestoreConstants, getCollectionDocId } from '@infinityxyz/lib/utils';
import { Injectable } from '@nestjs/common';
import { FirebaseService } from 'firebase/firebase.service';

@Injectable()
export default class CollectionService {
  constructor(private firebaseService: FirebaseService) {}

  async getCollection(collection: { address: string; chainId: string }): Promise<Collection> {
    const collectionSnapshot = await this.firebaseService.firestore
      .collection(firestoreConstants.COLLECTIONS_COLL)
      .doc(getCollectionDocId({ collectionAddress: collection.address, chainId: collection.chainId }))
      .get();
    return collectionSnapshot.data() as Collection;
  }
}
