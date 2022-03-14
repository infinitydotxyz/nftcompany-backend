import { firestore } from 'container';
import { OrderDirection } from '@infinityxyz/lib/types/core';
import { firestoreConstants } from '@infinityxyz/lib/utils';

export async function getVerifiedCollections(limit: number, startAfterName?: string) {
  let query = firestore
    .collection(firestoreConstants.COLLECTIONS_COLL)
    .where('hasBlueCheck', '==', true)
    .orderBy('name', OrderDirection.Ascending);

  if (startAfterName) {
    query = query.startAfter(startAfterName);
  }

  const data = await query.limit(limit).get();

  const collections = (data?.docs || []).map((doc) => {
    return {
      ...doc.data(),
      id: doc.id
    };
  });

  return collections;
}
