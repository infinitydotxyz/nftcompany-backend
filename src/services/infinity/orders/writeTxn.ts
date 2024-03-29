import { firestore } from 'container';
import { log } from '@infinityxyz/lib/utils';
import { ethers } from 'ethers';
import { getUserMissedTxnRef } from './getUserTxn';

/**
 * Value should be in wei
 * @returns
 */
export async function writeTxn(
  actionType: 'fulfill' | 'cancel',
  txnData: {
    isValid: boolean;
    from: string;
    buyer: string;
    seller: string;
    value: number;
    txnHash: string;
    chainId: string;
  }
) {
  const batch = firestore.db.batch();
  const valueInEth = +ethers.utils.formatEther(txnData.value?.toString?.() ?? '');

  const txnPayload = {
    txnHash: txnData.txnHash,
    status: 'pending',
    salePriceInEth: valueInEth,
    actionType,
    chainId: txnData.chainId,
    createdAt: Date.now(),
    buyer: txnData.buyer,
    seller: txnData.seller
  };

  const cancelOrder = () => {
    const cancelTxnRef = getUserMissedTxnRef(txnData.from, txnData.txnHash);
    batch.set(cancelTxnRef, txnPayload, { merge: true });
  };

  const fulfillOrder = () => {
    const buyerTxnRef = getUserMissedTxnRef(txnData.buyer, txnData.txnHash);
    batch.set(buyerTxnRef, txnPayload, { merge: true });

    const sellerTxnRef = getUserMissedTxnRef(txnData.seller, txnData.txnHash);
    batch.set(sellerTxnRef, txnPayload, { merge: true });
  };

  if (actionType === 'fulfill') {
    fulfillOrder();
  } else if (actionType === 'cancel') {
    cancelOrder();
  } else {
    throw new Error(`invalid action type`);
  }

  // Commit batch
  log('Committing the non-existent valid txn', txnData.txnHash, ' batch to firestore');

  return await batch.commit();
}
