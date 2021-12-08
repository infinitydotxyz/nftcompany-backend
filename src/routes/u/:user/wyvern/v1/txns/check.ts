import { firestore } from '@base/container';
import { postUserRateLimit } from '@base/middleware/rateLimit';
import { fstrCnstnts, NFTC_FEE_ADDRESS, WYVERN_ATOMIC_MATCH_FUNCTION, WYVERN_CANCEL_ORDER_FUNCTION } from '@constants';
import { waitForTxn } from '@routes/u/:user/reward';
import { bn } from '@utils/index.js';
import { getExchangeAddress, getProvider } from '@utils/ethers';
import { error, log } from '@utils/logger';
import { ethers } from 'ethers';
import { Router } from 'express';
import openseaAbi from '@base/abi/openseaExchangeContract.json';
import { StatusCode } from '@base/types/StatusCode';
const router = Router();

// check txn
router.post('/u/:user/wyvern/v1/txns/check', postUserRateLimit, async (req, res) => {
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
    } else {
      // check if doc exists
      const docRef = firestore.db
        .collection(fstrCnstnts.ROOT_COLL)
        .doc(fstrCnstnts.INFO_DOC)
        .collection(fstrCnstnts.USERS_COLL)
        .doc(from)
        .collection(fstrCnstnts.TXNS_COLL)
        .doc(txnHash);

      const doc = await docRef.get();
      if (doc.exists) {
        // listen for txn mined or not mined
        waitForTxn(from, doc.data());
        res.sendStatus(StatusCode.Ok);
        return;
      } else {
        // txn is valid but it doesn't exist in firestore
        // we write to firestore
        log('Txn', txnHash, 'is valid but it doesnt exist in firestore');
        const batch = firestore.db.batch();
        const valueInEth = +ethers.utils.formatEther('' + value);

        const txnPayload = {
          txnHash,
          status: 'pending',
          salePriceInEth: valueInEth,
          actionType,
          chainId,
          createdAt: Date.now(),
          buyer,
          seller
        };

        // if cancel order
        if (actionType === 'cancel') {
          const cancelTxnRef = firestore
            .collection(fstrCnstnts.ROOT_COLL)
            .doc(fstrCnstnts.INFO_DOC)
            .collection(fstrCnstnts.USERS_COLL)
            .doc(from)
            .collection(fstrCnstnts.MISSED_TXNS_COLL)
            .doc(txnHash);

          batch.set(cancelTxnRef, txnPayload, { merge: true });
        } else if (actionType === 'fulfill') {
          const buyerTxnRef = firestore
            .collection(fstrCnstnts.ROOT_COLL)
            .doc(fstrCnstnts.INFO_DOC)
            .collection(fstrCnstnts.USERS_COLL)
            .doc(buyer)
            .collection(fstrCnstnts.MISSED_TXNS_COLL)
            .doc(txnHash);

          batch.set(buyerTxnRef, txnPayload, { merge: true });

          const sellerTxnRef = firestore
            .collection(fstrCnstnts.ROOT_COLL)
            .doc(fstrCnstnts.INFO_DOC)
            .collection(fstrCnstnts.USERS_COLL)
            .doc(seller)
            .collection(fstrCnstnts.MISSED_TXNS_COLL)
            .doc(txnHash);

          batch.set(sellerTxnRef, txnPayload, { merge: true });
        }

        // commit batch
        log('Committing the non-existent valid txn', txnHash, ' batch to firestore');
        batch
          .commit()
          .then((resp) => {
            // no op
          })
          .catch((err) => {
            error('Failed to commit non-existent valid txn', txnHash, ' batch');
            error(err);
            res.sendStatus(StatusCode.InternalServerError);
          });
      }
    }
    res.sendStatus(StatusCode.Ok);
  } catch (err) {
    error('Error saving pending txn');
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
});

export async function getTxnData(txnHash: string, chainId: string, actionType: 'fulfill' | 'cancel') {
  let isValid = true;
  let from = '';
  let buyer = '';
  let seller = '';
  let value = bn(0);
  const provider = getProvider(chainId);
  const txn = provider ? await provider.getTransaction(txnHash) : null;
  if (txn) {
    from = txn.from ? txn.from.trim().toLowerCase() : '';
    const to = txn.to;
    const txnChainId = txn.chainId;
    const data = txn.data;
    value = txn.value;
    const openseaIface = new ethers.utils.Interface(openseaAbi);
    const decodedData = openseaIface.parseTransaction({ data, value });
    const functionName = decodedData.name;
    const args = decodedData.args;

    // checks
    const exchangeAddress = getExchangeAddress(chainId);
    if (to.toLowerCase() !== exchangeAddress.toLowerCase()) {
      isValid = false;
    }
    if (txnChainId !== +chainId) {
      isValid = false;
    }
    if (actionType === 'fulfill' && functionName !== WYVERN_ATOMIC_MATCH_FUNCTION) {
      isValid = false;
    }
    if (actionType === 'cancel' && functionName !== WYVERN_CANCEL_ORDER_FUNCTION) {
      isValid = false;
    }

    if (args && args.length > 0) {
      const addresses = args[0];
      if (addresses && actionType === 'fulfill' && addresses.length === 14) {
        buyer = addresses[1] ? addresses[1].trim().toLowerCase() : '';
        seller = addresses[8] ? addresses[8].trim().toLowerCase() : '';
        const buyFeeRecipient = addresses[3];
        const sellFeeRecipient = addresses[10];
        if (
          buyFeeRecipient.toLowerCase() !== NFTC_FEE_ADDRESS.toLowerCase() &&
          sellFeeRecipient.toLowerCase() !== NFTC_FEE_ADDRESS.toLowerCase()
        ) {
          isValid = false;
        }
      } else if (addresses && actionType === 'cancel' && addresses.length === 7) {
        const feeRecipient = addresses[3];
        if (feeRecipient.toLowerCase() !== NFTC_FEE_ADDRESS.toLowerCase()) {
          isValid = false;
        }
      } else {
        isValid = false;
      }
    } else {
      isValid = false;
    }
  } else {
    isValid = false;
  }
  return { isValid, from, buyer, seller, value };
}

export default router;
