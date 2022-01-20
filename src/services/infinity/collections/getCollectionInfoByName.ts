import { firestore } from '@base/container';
import { CollectionInfo } from '@base/types/NftInterface';
import { fstrCnstnts } from '@base/constants';

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
