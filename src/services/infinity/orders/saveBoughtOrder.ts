import { firestore } from 'container';
import { fstrCnstnts, SALE_FEES_TO_PURCHASE_FEES_RATIO } from '../../../constants';
import { bn, toFixed5 } from 'utils';
import { log, trace } from 'utils/logger';
import firebaseAdmin from 'firebase-admin';
import { getEmptyUserInfo } from '../utils';

export async function saveBoughtOrder(user: any, order: any, batch: any, numOrders: number) {
  log('Writing purchase to firestore for user', user);
  order.metadata.createdAt = Date.now();
  const ref = firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .collection(fstrCnstnts.PURCHASES_COLL)
    .doc();
  batch.set(ref, order, { merge: true });

  const fees = bn(order.metadata.feesInEth);
  const purchaseFees = fees.div(SALE_FEES_TO_PURCHASE_FEES_RATIO);
  const salePriceInEth = bn(order.metadata.salePriceInEth);

  const userInfoRef = await firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .get();
  const userInfo = { ...getEmptyUserInfo(), ...userInfoRef.data() };

  // update user txn stats
  const purchasesTotal = bn(userInfo.purchasesTotal).plus(salePriceInEth).toString();
  const purchasesFeesTotal = bn(userInfo.purchasesFeesTotal).plus(purchaseFees).toString();
  const purchasesTotalNumeric = toFixed5(purchasesTotal);
  const purchasesFeesTotalNumeric = toFixed5(purchasesFeesTotal);
  const salesAndPurchasesTotalNumeric = userInfo.salesAndPurchasesTotalNumeric + purchasesTotalNumeric;

  trace(
    'User',
    user,
    'User purchases total',
    purchasesTotal,
    'purchases fees total',
    purchasesFeesTotal,
    'purchases total numeric',
    purchasesTotalNumeric,
    'purchases fees total numeric',
    purchasesFeesTotalNumeric,
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
      numPurchases: firebaseAdmin.firestore.FieldValue.increment(numOrders),
      purchasesTotal,
      purchasesFeesTotal,
      purchasesTotalNumeric,
      purchasesFeesTotalNumeric,
      salesAndPurchasesTotalNumeric
    },
    { merge: true }
  );
}
