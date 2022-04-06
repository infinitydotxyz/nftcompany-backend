import { firestoreConstants, getCollectionDocId } from '@infinityxyz/lib/utils';
import { firestore } from 'container';

export async function getCollectionByAddress(collection: { collectionAddress: string; chainId: string }) {
  const doc = await firestore.collection(firestoreConstants.COLLECTIONS_COLL).doc(getCollectionDocId(collection)).get();

  if (doc.exists) {
    const data = doc.data();
    if (!data) {
      return;
    }

    return data;
  }
}
