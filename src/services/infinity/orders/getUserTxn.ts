import { firestore } from 'container';
import { fstrCnstnts } from '../../../constants';

export function getUserTxnsRef(userAddress: string) {
  return firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(userAddress)
    .collection(fstrCnstnts.TXNS_COLL);
}

export function getUserTxnRef(userAddress: string, txnHash: string) {
  return getUserTxnsRef(userAddress).doc(txnHash);
}

export function getUserMissedTxnsRef(userAddress: string) {
  return firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(userAddress)
    .collection(fstrCnstnts.MISSED_TXNS_COLL);
}

export function getUserMissedTxnRef(userAddress: string, txnHash: string) {
  return getUserMissedTxnsRef(userAddress).doc(txnHash);
}
