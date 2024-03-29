import { OrderSide, OrderDirection, StatusCode } from '@infinityxyz/lib/types/core';
import { getUserMissedTxnsRef, getUserTxnRef, getUserTxnsRef } from 'services/infinity/orders/getUserTxn';
import { waitForMissedTxn } from 'services/infinity/orders/waitForMissedTxn';
import { waitForTxn } from 'services/infinity/orders/waitForTxn';
import { error, log, trimLowerCase, jsonString } from '@infinityxyz/lib/utils';
import { parseQueryFields } from 'utils/parsers';
import { Request, Response } from 'express';

export const getUserTxns = async (req: Request<{ user: string }>, res: Response) => {
  const user = trimLowerCase(req.params.user);
  const queries = parseQueryFields(res, req, ['limit', 'startAfterMillis'], ['50', `${Date.now()}`]);

  if ('error' in queries) {
    return;
  }
  if (!user) {
    error('Invalid input');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }
  try {
    const getTxnSnapshot = async () => {
      return await getUserTxnsRef(user)
        .orderBy('createdAt', OrderDirection.Descending)
        .startAfter(queries.startAfterMillis)
        .limit(queries.limit)
        .get();
    };

    const getMissedTxnSnapshot = async () => {
      return await getUserMissedTxnsRef(user)
        .orderBy('createdAt', OrderDirection.Descending)
        .startAfter(queries.startAfterMillis)
        .limit(queries.limit)
        .get();
    };

    const [snapshot, missedTxnSnapshot] = await Promise.all([getTxnSnapshot(), getMissedTxnSnapshot()]);

    const txns: any[] = [];
    for (const doc of snapshot.docs) {
      const txn = doc.data();
      txn.id = doc.id;
      txns.push(txn);
      // Check status
      if (txn.status === 'pending') {
        void waitForTxn(user, txn);
      }
    }

    for (const doc of missedTxnSnapshot.docs) {
      const txn = doc.data();
      txn.id = doc.id;
      txns.push(txn);
      // Check status
      if (txn.status === 'pending') {
        void waitForMissedTxn(user, txn);
      }
    }

    const resp = {
      count: txns.length,
      listings: txns
    };
    const respStr = jsonString(resp);
    res.set({
      'Cache-Control': 'must-revalidate, max-age=30',
      'Content-Length': Buffer.byteLength(respStr ?? '', 'utf8')
    });
    res.send(respStr);
  } catch (err: any) {
    error(`Failed to get pending txns of user ${user}`);
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};

// Save txn
// Called on buy now, accept offer, cancel offer, cancel listing
export const postUserTxn = async (req: Request<{ user: string }>, res: Response) => {
  try {
    const payload = req.body;

    if (Object.keys(payload).length === 0) {
      error('Invalid input');
      res.sendStatus(StatusCode.BadRequest);
      return;
    }

    const user = trimLowerCase(req.params.user);
    if (!user) {
      error('Invalid input');
      res.sendStatus(StatusCode.BadRequest);
      return;
    }

    if (!payload.actionType || !payload.txnHash || !payload.orderId || !payload.maker || !payload.chainId) {
      error('Invalid input');
      res.sendStatus(StatusCode.BadRequest);
      return;
    }

    // Input checking
    let inputError = '';
    const actionType = payload.actionType.trim().toLowerCase(); // Either fulfill or cancel
    if (actionType !== 'fulfill' && actionType !== 'cancel') {
      inputError += `Invalid actionType: ${actionType} `;
    }

    const txnHash = payload.txnHash.trim(); // Preserve case
    if (!txnHash) {
      inputError += 'Payload does not have txnHash ';
    }

    const side = +payload.side;
    if (side !== OrderSide.Buy && side !== OrderSide.Sell) {
      inputError += `Unknown order side: ${side} `;
    }

    const orderId = payload.orderId.trim(); // Preserve case
    if (!orderId) {
      inputError += 'Payload does not have orderId ';
    }

    // Input checking for fulfill action
    if (actionType === 'fulfill') {
      const salePriceInEth = +payload.salePriceInEth;
      if (Number.isNaN(salePriceInEth)) {
        inputError += `Invalid salePriceInEth: ${salePriceInEth} `;
      }

      const feesInEth = +payload.feesInEth;
      if (Number.isNaN(feesInEth)) {
        inputError += `Invalid feesInEth: ${feesInEth} `;
      }

      const maker = payload.maker.trim().toLowerCase();
      if (!maker) {
        inputError += 'Payload does not have maker ';
      }
    }

    if (inputError) {
      error('Invalid input');
      res.sendStatus(StatusCode.BadRequest);
      return;
    }

    // Check if already exists
    const docRef = getUserTxnRef(user, txnHash);
    const doc = await docRef.get();
    if (doc.exists) {
      error('Txn already exists in firestore', txnHash);
      res.status(StatusCode.InternalServerError).send(`Txn already exists: ${txnHash}`);
      return;
    }

    // Save to firestore
    payload.status = 'pending';
    payload.txnType = 'original'; // Possible values are original, cancellation and replacement
    payload.createdAt = Date.now();
    log('Writing txn', txnHash, 'in pending state to firestore for user', user);
    docRef
      .set(payload)
      .then(() => {
        // Listen for txn mined or not mined
        void waitForTxn(user, payload);
        res.sendStatus(StatusCode.Ok);
      })
      .catch((err: Error) => {
        error('Error saving pending txn');
        error(err);
        res.sendStatus(StatusCode.InternalServerError);
      });
  } catch (err: any) {
    error('Error saving pending txn');
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};
