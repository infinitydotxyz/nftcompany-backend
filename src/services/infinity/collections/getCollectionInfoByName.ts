import { firestore } from 'container';
import { CollectionInfo } from '@infinityxyz/types/core';
import { fstrCnstnts } from '../../../constants';

export async function getCollectionInfoByName(searchCollectionName: string, limit: number) {
  const res = await firestore
    .collection(fstrCnstnts.ALL_COLLECTIONS_COLL)
    .where('searchCollectionName', '==', searchCollectionName)
    .limit(limit)
    .get();
  const data: CollectionInfo[] = res.docs.map((doc) => {
    return doc.data() as CollectionInfo;
  });

  return data;
}
