import { firestore } from '@base/container';
import { fstrCnstnts } from '@constants';

export async function getSaleLeaders(limit: number) {
  const sales = await firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .orderBy('salesTotalNumeric', 'desc')
    .limit(limit)
    .get();

  const saleLeaders = [];
  for (const doc of sales.docs) {
    const docData = doc.data();
    const result = {
      id: doc.id,
      total: docData.salesTotalNumeric
    };
    saleLeaders.push(result);
  }

  return saleLeaders;
}