/* eslint-disable @typescript-eslint/ban-ts-comment */
import { firestore } from 'container';
import { fstrCnstnts } from '../../../constants';
import { getProvider } from 'utils/ethers';
import { error, log, trace, jsonString } from '@infinityxyz/lib/utils';
import firebaseAdmin from 'firebase-admin';
import { getEmptyUserInfo } from '../utils';
import { isValidNftcTxn } from './isValidNftcTxn';

export async function waitForMissedTxn(user: any, payload: any) {
  user = user.trim().toLowerCase();
  const actionType = payload.actionType.trim().toLowerCase();
  const txnHash = payload.txnHash.trim();
  const chainId = payload.chainId;

  log('Waiting for missed txn', txnHash);
  const batch = firestore.db.batch();
  const userTxnCollRef = firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .collection(fstrCnstnts.MISSED_TXNS_COLL);

  const txnDocRef = userTxnCollRef.doc(txnHash);
  const confirms = 1;

  try {
    // check if valid nftc txn
    const isValid = await isValidNftcTxn(txnHash, chainId, actionType);
    if (!isValid) {
      error('Invalid NFTC txn', txnHash);
      return;
    }

    const provider = getProvider(chainId);
    if (provider == null) {
      error('Not waiting for txn since provider is null');
      return;
    }
    const receipt = await provider.waitForTransaction(txnHash, confirms);

    // check if txn status is not already updated in firestore by another call
    try {
      const isUpdated = await firestore.db.runTransaction(async (txn) => {
        const txnDoc = await txn.get(txnDocRef);
        if (actionType === 'fulfill') {
          const buyer = txnDoc.get('buyer');
          const seller = txnDoc.get('seller');

          const buyerTxnRef = firestore
            .collection(fstrCnstnts.ROOT_COLL)
            .doc(fstrCnstnts.INFO_DOC)
            .collection(fstrCnstnts.USERS_COLL)
            .doc(buyer)
            .collection(fstrCnstnts.MISSED_TXNS_COLL)
            .doc(txnHash);

          const sellerTxnRef = firestore
            .collection(fstrCnstnts.ROOT_COLL)
            .doc(fstrCnstnts.INFO_DOC)
            .collection(fstrCnstnts.USERS_COLL)
            .doc(seller)
            .collection(fstrCnstnts.MISSED_TXNS_COLL)
            .doc(txnHash);

          const buyerTxnDoc = await txn.get(buyerTxnRef);
          const sellerTxnDoc = await txn.get(sellerTxnRef);

          const buyerStatus = buyerTxnDoc.get('status');
          const sellerStatus = sellerTxnDoc.get('status');
          if (buyerStatus === 'pending' && sellerStatus === 'pending') {
            // orig txn confirmed
            log(`Missed fulfill txn: ${txnHash} confirmed after ${receipt.confirmations} block(s)`);
            const txnData = JSON.parse(jsonString(receipt));
            const txnSuceeded = txnData.status === 1;
            const updatedStatus = txnSuceeded ? 'confirmed' : 'failed';
            await txn.update(buyerTxnRef, { status: updatedStatus, txnData });
            await txn.update(sellerTxnRef, { status: updatedStatus, txnData });
            return txnSuceeded;
          } else {
            return false;
          }
        } else if (actionType === 'cancel') {
          const docRef = firestore
            .collection(fstrCnstnts.ROOT_COLL)
            .doc(fstrCnstnts.INFO_DOC)
            .collection(fstrCnstnts.USERS_COLL)
            .doc(user)
            .collection(fstrCnstnts.MISSED_TXNS_COLL)
            .doc(txnHash);

          const doc = await txn.get(docRef);
          const status = doc.get('status');
          if (status === 'pending') {
            // orig txn confirmed
            log(`Missed cancel txn: ${txnHash} confirmed after ${receipt.confirmations} block(s)`);
            const txnData = JSON.parse(jsonString(receipt));
            const txnSuceeded = txnData.status === 1;
            const updatedStatus = txnSuceeded ? 'confirmed' : 'failed';
            await txn.update(docRef, { status: updatedStatus, txnData });
            return txnSuceeded;
          } else {
            return false;
          }
        }
        return false;
      });

      if (isUpdated) {
        if (actionType === 'fulfill') {
          const numOrders = 1;
          const buyer = payload.buyer.trim().toLowerCase();
          const seller = payload.seller.trim().toLowerCase();
          const valueInEth = payload.salePriceInEth;

          const buyerRef = firestore
            .collection(fstrCnstnts.ROOT_COLL)
            .doc(fstrCnstnts.INFO_DOC)
            .collection(fstrCnstnts.USERS_COLL)
            .doc(buyer);

          const sellerRef = firestore
            .collection(fstrCnstnts.ROOT_COLL)
            .doc(fstrCnstnts.INFO_DOC)
            .collection(fstrCnstnts.USERS_COLL)
            .doc(seller);

          const buyerInfoRef = await buyerRef.get();
          let buyerInfo = getEmptyUserInfo();
          if (buyerInfoRef.exists) {
            buyerInfo = { ...buyerInfo, ...buyerInfoRef.data() };
          }

          const sellerInfoRef = await sellerRef.get();
          let sellerInfo = getEmptyUserInfo();
          if (sellerInfoRef.exists) {
            sellerInfo = { ...sellerInfo, ...sellerInfoRef.data() };
          }

          // update user txn stats
          // @ts-expect-error
          const purchasesTotal = bn(buyerInfo.purchasesTotal).plus(valueInEth).toString();
          // @ts-expect-error
          const purchasesTotalNumeric = toFixed5(purchasesTotal);

          // update user txn stats
          // @ts-expect-error
          const salesTotal = bn(sellerInfo.salesTotal).plus(valueInEth).toString();
          // @ts-expect-error
          const salesTotalNumeric = toFixed5(salesTotal);

          trace(
            'Buyer',
            buyer,
            'Seller',
            seller,
            'purchases total',
            purchasesTotal,
            'purchases total numeric',
            purchasesTotalNumeric,
            'sales total',
            salesTotal,
            'sales total numeric',
            salesTotalNumeric
          );

          batch.set(
            buyerRef,
            {
              numPurchases: firebaseAdmin.firestore.FieldValue.increment(numOrders),
              purchasesTotal,
              purchasesTotalNumeric
            },
            { merge: true }
          );

          batch.set(
            sellerRef,
            {
              numSales: firebaseAdmin.firestore.FieldValue.increment(numOrders),
              salesTotal,
              salesTotalNumeric
            },
            { merge: true }
          );

          // commit batch
          log('Updating purchase and sale data for missed txn', txnHash, 'in firestore');
          batch
            .commit()
            .then(() => {
              // no op
            })
            .catch((err) => {
              error('Failed updating purchase and sale data for missed txn', txnHash);
              error(err);
            });
        }
      }
    } catch (err) {
      error('Error updating missed txn status in firestore');
      error(err);
    }
  } catch (err) {
    error('Error waiting for missed txn');
    error(err);
  }
}
