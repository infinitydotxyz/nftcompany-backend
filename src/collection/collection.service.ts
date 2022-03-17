import { Collection } from '@infinityxyz/lib/types/core';
import { firestoreConstants, getCollectionDocId } from '@infinityxyz/lib/utils';
import { Injectable } from '@nestjs/common';
import DefaultFirebaseProvider from 'firebase/default.firebase.provider';

@Injectable()
export default class CollectionService {
  private db: FirebaseFirestore.Firestore;

  constructor(private firebaseProvider: DefaultFirebaseProvider) {
    this.db = this.firebaseProvider.firebaseAdmin.firestore();
  }

  async getCollection(collection: { address: string; chainId: string }): Promise<Collection> {
    const collectionSnapshot = await this.db
      .collection(firestoreConstants.COLLECTIONS_COLL)
      .doc(getCollectionDocId({ collectionAddress: collection.address, chainId: collection.chainId }))
      .get();
    return collectionSnapshot.data() as Collection;
  }
}
