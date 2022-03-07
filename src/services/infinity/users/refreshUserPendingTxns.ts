import { OrderDirection } from '@infinityxyz/types/core';
import { error } from 'utils/logger';
import { getUserMissedTxnsRef, getUserTxnsRef } from '../orders/getUserTxn';
import { waitForMissedTxn } from '../orders/waitForMissedTxn';
import { waitForTxn } from '../orders/waitForTxn';

export async function refreshUserPendingTxns(userAddress: string) {
  try {
    const limit = 50;

    const getTxnSnapshot = async () => {
      return await getUserTxnsRef(userAddress).orderBy('createdAt', OrderDirection.Descending).limit(limit).get();
    };

    const getMissedTxnSnapshot = async () => {
      return await getUserMissedTxnsRef(userAddress).orderBy('createdAt', OrderDirection.Descending).limit(limit).get();
    };

    const [snapshot, missedTxnSnapshot] = await Promise.all([getTxnSnapshot(), getMissedTxnSnapshot()]);

    for (const doc of snapshot.docs) {
      const txn = doc.data();
      // check status
      if (txn.status === 'pending') {
        void waitForTxn(userAddress, txn);
      }
    }

    for (const doc of missedTxnSnapshot.docs) {
      const txn = doc.data();
      // check status
      if (txn.status === 'pending') {
        void waitForMissedTxn(userAddress, txn);
      }
    }
  } catch (err) {
    error('Error refreshing pending txns');
    error(err);
  }
}
