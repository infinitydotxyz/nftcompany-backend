import { firestore } from '@base/container';
import { OrderDirection } from 'infinity-types/types/Queries';
import { fstrCnstnts } from '@base/constants';

export async function getVerifiedCollections(limit: number, startAfterName?: string) {
  let query = firestore
    .collection(fstrCnstnts.ALL_COLLECTIONS_COLL)
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
