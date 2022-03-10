import { firestore } from 'container';
import { fstrCnstnts } from '../../../constants';
import { getProvider } from 'utils/ethers';
import { error, log, jsonString } from '@infinityxyz/lib/utils';
import { cancelListing } from '../listings/cancelListing';
import { cancelOffer } from '../offers/cancelOffer';
import { fulfillOrder } from './fulfillOrder';
import { isValidNftcTxn } from './isValidNftcTxn';

export async function waitForTxn(user: any, payload: any) {
  user = user.trim().toLowerCase();
  const actionType = payload.actionType.trim().toLowerCase();
  const origTxnHash = payload.txnHash.trim();
  const chainId = payload.chainId;

  log('Waiting for txn', origTxnHash);
  const batch = firestore.db.batch();
  const userTxnCollRef = firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .collection(fstrCnstnts.TXNS_COLL);

  const origTxnDocRef = userTxnCollRef.doc(origTxnHash);
  const confirms = 1;

  try {
    // check if valid nftc txn
    const isValid = await isValidNftcTxn(origTxnHash, chainId, actionType);
    if (!isValid) {
      error('Invalid NFTC txn', origTxnHash);
      return;
    }

    const provider = getProvider(chainId);
    if (provider == null) {
      error('Not waiting for txn since provider is null');
      return;
    }
    const receipt = await provider.waitForTransaction(origTxnHash, confirms);

    // check if txn status is not already updated in firestore by another call - (from the get txns method for instance)
    try {
      const isUpdated = await firestore.db.runTransaction(async (txn) => {
        const txnDoc = await txn.get(origTxnDocRef);
        const status = txnDoc.get('status');
        if (status === 'pending') {
          // orig txn confirmed
          log(`Txn: ${origTxnHash} confirmed after ${receipt.confirmations} block(s)`);
          const txnData = JSON.parse(jsonString(receipt));
          const txnSuceeded = txnData.status === 1;
          const updatedStatus = txnSuceeded ? 'confirmed' : 'failed';
          txn.update(origTxnDocRef, { status: updatedStatus, txnData });
          return txnSuceeded;
        } else {
          return false;
        }
      });

      if (isUpdated) {
        if (actionType === 'fulfill') {
          await fulfillOrder(user, batch, payload);
        } else if (actionType === 'cancel') {
          const docId = payload.orderId.trim(); // preserve case
          const side = +payload.side;
          if (side === 0) {
            await cancelOffer(user, batch, docId);
          } else if (side === 1) {
            await cancelListing(user, batch, docId);
          }
        }
      }
    } catch (err) {
      error('Error updating txn status in firestore');
      error(err);
    }
  } catch (err) {
    error(`Txn: ${origTxnHash} was rejected`);
    // if the txn failed, err.receipt.status = 0
    if (err.receipt && err.receipt.status === 0) {
      error(`Txn with hash: ${origTxnHash} rejected`);
      error(err);

      const txnData = JSON.parse(jsonString(err.receipt));
      batch.set(origTxnDocRef, { status: 'rejected', txnData }, { merge: true });
    }
    // if the txn failed due to replacement or cancellation or repricing
    if (err?.reason && err.replacement) {
      error(`Txn with hash: ${origTxnHash} rejected with reason ${err.reason}`);
      error(err);

      const replacementTxnHash = err.replacement.hash;
      if (err.reason === 'cancelled') {
        payload.txnType = 'cancellation';
        batch.set(origTxnDocRef, { status: 'cancelled', cancelTxnHash: replacementTxnHash }, { merge: true });
      } else {
        payload.txnType = 'replacement';
        batch.set(origTxnDocRef, { status: 'replaced', replaceTxnHash: replacementTxnHash }, { merge: true });
      }
      // write a new pending txn in firestore
      log(`Writing replacement txn: ${replacementTxnHash} to firestore`);
      const newTxnDocRef = userTxnCollRef.doc(replacementTxnHash);
      payload.createdAt = Date.now();
      const newPayload = {
        origTxnHash,
        ...payload
      };
      batch.set(newTxnDocRef, newPayload);
    }
  }

  // commit batch
  log('Committing the big `wait for txn`', origTxnHash, 'batch to firestore');
  batch
    .commit()
    .then((resp) => {
      // no op
    })
    .catch((err) => {
      error('Failed to commit pending txn batch');
      error(err);
    });
}
