import { firestore } from 'container';
import { OrderDirection } from '@infinityxyz/lib/types/core';
import { fstrCnstnts } from '../../../../constants';

export async function getPurchaseLeaders(limit: number) {
  const buys = await firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .orderBy('purchasesTotalNumeric', OrderDirection.Descending)
    .limit(limit)
    .get();

  const purchaseLeaders: any[] = [];
  for (const doc of buys.docs) {
    const docData = doc.data();
    const result = {
      id: doc.id,
      total: docData.purchasesTotalNumeric
    };
    purchaseLeaders.push(result);
  }

  return purchaseLeaders;
}
