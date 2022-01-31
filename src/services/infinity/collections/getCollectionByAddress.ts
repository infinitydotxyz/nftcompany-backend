import { fstrCnstnts } from '@base/constants';
import { firestore } from '@base/container';

export async function getCollectionByAddress(address: string) {
  const doc = await firestore.collection(fstrCnstnts.ALL_COLLECTIONS_COLL).doc(address).get();

  if (doc.exists) {
    const data = doc.data();
    if (!data) return;

    return data;
  }
}
