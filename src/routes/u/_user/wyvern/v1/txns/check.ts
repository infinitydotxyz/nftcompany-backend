import { error, log } from '@utils/logger';
import { Request, Response } from 'express';
import { StatusCode } from '@base/types/StatusCode';
import { getTxnData } from '@services/infinity/orders/getTxnData';
import { getUserTxnRef } from '@services/infinity/orders/getUserTxn';
import { writeTxn } from '@services/infinity/orders/writeTxn';
import { waitForTxn } from '@services/infinity/orders/waitForTxn';

// check txn
export const postTxnCheck = async (req: Request<{ user: string }>, res: Response) => {
  try {
    const payload = req.body;

    if (Object.keys(payload).length === 0) {
      error('Invalid input - payload empty');
      res.sendStatus(StatusCode.BadRequest);
      return;
    }

    const user = (`${req.params.user}` || '').trim().toLowerCase();
    if (!user) {
      error('Invalid input - no user');
      res.sendStatus(StatusCode.BadRequest);
      return;
    }

    if (!payload.txnHash || !payload.txnHash.trim()) {
      error('Invalid input - no txn hash');
      res.sendStatus(StatusCode.BadRequest);
      return;
    }

    if (!payload.actionType) {
      error('Invalid input - no action type');
      res.sendStatus(StatusCode.BadRequest);
      return;
    }

    if (!payload.chainId) {
      error('Invalid input - no chainId');
      res.sendStatus(StatusCode.BadRequest);
      return;
    }

    const actionType = payload.actionType.trim().toLowerCase(); // either fulfill or cancel
    if (actionType !== 'fulfill' && actionType !== 'cancel') {
      error('Invalid action type', actionType);
      res.sendStatus(StatusCode.BadRequest);
      return;
    }

    const txnHash = payload.txnHash.trim(); // preserve case
    const chainId = payload.chainId;

    // check if valid nftc txn
    const { isValid, from, buyer, seller, value } = await getTxnData(txnHash, chainId, actionType);
    if (!isValid) {
      error('Invalid NFTC txn', txnHash);
      res.sendStatus(StatusCode.BadRequest);
      return;
    }

    const txnRef = getUserTxnRef(from, txnHash);
    const txnDoc = await txnRef.get();

    if (txnDoc.exists) {
      // listen for txn mined or not mined
      void waitForTxn(from, txnDoc.data());
      res.sendStatus(StatusCode.Ok);
      return;
    }

    // txn is valid but it doesn't exist in firestore
    // we write to firestore
    log('Txn', txnHash, 'is valid but it doesnt exist in firestore');
    await writeTxn(actionType, { isValid, from, buyer, seller, value, txnHash, chainId });
    res.sendStatus(StatusCode.Ok);
    return;
  } catch (err) {
    error('Error saving pending txn');
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};