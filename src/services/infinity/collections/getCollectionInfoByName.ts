import { firestore } from 'container';
import { CollectionInfo } from '@infinityxyz/lib/types/core';
import { firestoreConstants } from '@infinityxyz/lib/utils';

export async function getCollectionInfoByName(searchCollectionName: string, limit: number) {
  const res = await firestore
    .collection(firestoreConstants.COLLECTIONS_COLL)
    .where('searchCollectionName', '==', searchCollectionName)
    .limit(limit)
    .get();
  const data: CollectionInfo[] = res.docs.map((doc) => {
    return doc.data() as CollectionInfo;
  });

  return data;
}
