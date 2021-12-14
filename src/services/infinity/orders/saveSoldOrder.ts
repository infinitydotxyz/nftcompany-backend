import { firestore } from '@base/container';
import { fstrCnstnts } from '@constants';
import { bn, toFixed5 } from '@utils/index';
import { log, trace } from '@utils/logger';
import firebaseAdmin from 'firebase-admin';
import { getEmptyUserInfo } from '../utils';

export async function saveSoldOrder(user: any, order: any, batch: any, numOrders: number) {
  log('Writing sale to firestore for user', user);
  order.metadata.createdAt = Date.now();
  const ref = firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .collection(fstrCnstnts.SALES_COLL)
    .doc();
  batch.set(ref, order, { merge: true });

  const feesInEth = bn(order.metadata.feesInEth);
  const salePriceInEth = bn(order.metadata.salePriceInEth);

  const userInfoRef = await firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .get();
  const userInfo = { ...getEmptyUserInfo(), ...userInfoRef.data() };

  // update user txn stats
  const salesTotal = bn(userInfo.salesTotal).plus(salePriceInEth).toString();
  const salesFeesTotal = bn(userInfo.salesFeesTotal).plus(feesInEth).toString();
  const salesTotalNumeric = toFixed5(salesTotal);
  const salesFeesTotalNumeric = toFixed5(salesFeesTotal);
  const salesAndPurchasesTotalNumeric = userInfo.salesAndPurchasesTotalNumeric + salesTotalNumeric;

  trace(
    'User',
    user,
    'User sales total',
    salesTotal,
    'sales fees total',
    salesFeesTotal,
    'sales total numeric',
    salesTotalNumeric,
    'sales fees total numeric',
    salesFeesTotalNumeric,
    'salesAndPurchasesTotalNumeric',
    salesAndPurchasesTotalNumeric
  );

  const userDocRef = firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user);

  batch.set(
    userDocRef,
    {
      numSales: firebaseAdmin.firestore.FieldValue.increment(numOrders),
      salesTotal,
      salesFeesTotal,
      salesTotalNumeric,
      salesFeesTotalNumeric,
      salesAndPurchasesTotalNumeric
    },
    { merge: true }
  );
}
