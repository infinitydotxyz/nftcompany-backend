import { firestore } from '@base/container';
import firebaseAdmin from 'firebase-admin';
import { getUserRateLimit } from '@base/middleware/rateLimit';
import { RewardTiers, UsPersonAnswer } from '@base/types/Rewards';
import { StatusCode } from '@base/types/StatusCode';
import {
  fstrCnstnts,
  INFINITY_EMAIL,
  NFTC_FEE_ADDRESS,
  SALE_FEES_TO_PURCHASE_FEES_RATIO,
  SITE_BASE,
  WYVERN_ATOMIC_MATCH_FUNCTION,
  WYVERN_CANCEL_ORDER_FUNCTION
} from '@constants';
import { getExchangeAddress, getProvider } from '@utils/ethers';
import { jsonString } from '@utils/formatters';
import { bn, toFixed5 } from '@utils/index.js';
import { error, log, trace } from '@utils/logger';
import { Request, Response } from 'express';
import { ethers } from 'ethers';
import openseaAbi from '@base/abi/openseaExchangeContract.json';
import { JsonFragment } from '@ethersproject/abi';
import { deleteOffer, updateNumOrders } from '@routes/listings';
import nodemailer from 'nodemailer';
import mailCreds from '@base/../creds/nftc-dev-nodemailer-creds.json';

// fetch user reward
// router.get('/', getUserRateLimit,
export const getUserReward = async (req: Request<{ user: string }>, res: Response) => {
  const user = (`${req.params.user}` || '').trim().toLowerCase();
  if (!user) {
    error('Invalid input');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }
  try {
    const resp = await getReward(user);
    res.send(resp);
  } catch (err) {
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};

/**
 *
 * @param user
 * @returns
 */
export async function getReward(userAddress: string) {
  log('Getting reward for user', userAddress);

  const userRef = await firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(userAddress)
    .get();

  const userOpenseaRef = await firestore.collection(fstrCnstnts.OPENSEA_COLL).doc(userAddress).get();

  let openseaVol = 0;
  let rewardTier = {};
  let hasAirdrop = false;
  if (userOpenseaRef.exists) {
    openseaVol = userOpenseaRef.get('totalVolUSD');
    rewardTier = getUserRewardTier(openseaVol);
    hasAirdrop = true;
  }

  let userStats = userRef.data();
  userStats = { ...getEmptyUserInfo(), ...userStats };

  let usPerson = UsPersonAnswer.none;
  const userProfile = userStats.profileInfo;
  if (userProfile && userProfile.usResidentStatus) {
    usPerson = userProfile.usResidentStatus.usPerson;
  }

  const numListings = bn(userStats.numListings);
  const numBonusListings = bn(userStats.numBonusListings);
  const numOffers = bn(userStats.numOffers);
  const numBonusOffers = bn(userStats.numBonusOffers);
  const numPurchases = bn(userStats.numPurchases);
  const numSales = bn(userStats.numSales);

  const salesTotal = bn(userStats.salesFeesTotal);
  const salesFeesTotal = bn(userStats.salesFeesTotal);
  const salesTotalNumeric = userStats.salesTotalNumeric;
  const salesFeesTotalNumeric = userStats.salesFeesTotalNumeric;

  const purchasesTotal = bn(userStats.purchasesTotal);
  const purchasesFeesTotal = bn(userStats.purchasesFeesTotal);
  const purchasesTotalNumeric = userStats.purchasesTotalNumeric;
  const purchasesFeesTotalNumeric = userStats.purchasesFeesTotalNumeric;

  const doneSoFar = +salesTotalNumeric + +purchasesTotalNumeric;

  // initiate refresh pending txns
  refreshPendingTxns(userAddress);

  const resp = {
    numSales: numSales.toString(),
    numPurchases: numPurchases.toString(),
    salesTotal: salesTotal.toString(),
    salesFeesTotal: salesFeesTotal.toString(),
    salesTotalNumeric,
    salesFeesTotalNumeric,
    purchasesTotal: purchasesTotal.toString(),
    purchasesFeesTotal: purchasesFeesTotal.toString(),
    purchasesTotalNumeric,
    purchasesFeesTotalNumeric,
    numListings: numListings.toString(),
    numBonusListings: numBonusListings.toString(),
    numOffers: numOffers.toString(),
    numBonusOffers: numBonusOffers.toString(),
    hasAirdrop,
    openseaVol,
    rewardTier,
    doneSoFar,
    usPerson
  };

  // write net reward to firestore async for leaderboard purpose
  firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(userAddress)
    .set(
      {
        openseaVol: openseaVol,
        rewardCalculatedAt: Date.now()
      },
      { merge: true }
    )
    .catch((err) => {
      error('Error updating reward info for user ' + userAddress);
      error(err);
    });

  return resp;
}

export function getEmptyUserInfo() {
  return {
    numListings: '0',
    numBonusListings: '0',
    numOffers: '0',
    numBonusOffers: '0',
    numPurchases: '0',
    numSales: '0',
    salesTotal: '0',
    salesFeesTotal: '0',
    purchasesTotal: '0',
    purchasesFeesTotal: '0',
    salesTotalNumeric: 0,
    salesFeesTotalNumeric: 0,
    purchasesTotalNumeric: 0,
    purchasesFeesTotalNumeric: 0,
    salesAndPurchasesTotalNumeric: 0,
    rewardsInfo: getEmptyUserRewardInfo()
  };
}

export function getEmptyUserRewardInfo() {
  return {
    share: '0',
    bonusShare: '0',
    salesShare: '0',
    purchasesShare: '0',
    rewardDebt: '0',
    bonusRewardDebt: '0',
    saleRewardDebt: '0',
    purchaseRewardDebt: '0',
    pending: '0',
    bonusPending: '0',
    salePending: '0',
    purchasePending: '0',
    grossReward: '0',
    netReward: '0',
    grossRewardNumeric: 0,
    netRewardNumeric: 0,
    openseaVol: 0,
    rewardCalculatedAt: Date.now()
  };
}

export async function refreshPendingTxns(user: any) {
  try {
    const limit = 50;

    const snapshot = await firestore
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.USERS_COLL)
      .doc(user)
      .collection(fstrCnstnts.TXNS_COLL)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const missedTxnSnapshot = await firestore
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.USERS_COLL)
      .doc(user)
      .collection(fstrCnstnts.MISSED_TXNS_COLL)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    for (const doc of snapshot.docs) {
      const txn = doc.data();
      // check status
      if (txn.status === 'pending') {
        waitForTxn(user, txn);
      }
    }

    for (const doc of missedTxnSnapshot.docs) {
      const txn = doc.data();
      // check status
      if (txn.status === 'pending') {
        waitForMissedTxn(user, txn);
      }
    }
  } catch (err) {
    error('Error refreshing pending txns');
    error(err);
  }
}

export function getUserRewardTier(userVol: number) {
  const rewardTiers = RewardTiers;

  if (userVol >= rewardTiers.t1.min && userVol < rewardTiers.t1.max) {
    return rewardTiers.t1;
  } else if (userVol >= rewardTiers.t2.min && userVol < rewardTiers.t2.max) {
    return rewardTiers.t2;
  } else if (userVol >= rewardTiers.t3.min && userVol < rewardTiers.t3.max) {
    return rewardTiers.t3;
  } else if (userVol >= rewardTiers.t4.min && userVol < rewardTiers.t4.max) {
    return rewardTiers.t4;
  } else if (userVol >= rewardTiers.t5.min && userVol < rewardTiers.t5.max) {
    return rewardTiers.t5;
  } else {
    return null;
  }
}

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
    if (!provider) {
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
            log('Missed fulfill txn: ' + txnHash + ' confirmed after ' + receipt.confirmations + ' block(s)');
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
            log('Missed cancel txn: ' + txnHash + ' confirmed after ' + receipt.confirmations + ' block(s)');
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
          // @ts-ignore
          const purchasesTotal = bn(buyerInfo.purchasesTotal).plus(valueInEth).toString();
          // @ts-ignore
          const purchasesTotalNumeric = toFixed5(purchasesTotal);

          // update user txn stats
          // @ts-ignore
          const salesTotal = bn(sellerInfo.salesTotal).plus(valueInEth).toString();
          // @ts-ignore
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
            .then((resp) => {
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
    if (!provider) {
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
          log('Txn: ' + origTxnHash + ' confirmed after ' + receipt.confirmations + ' block(s)');
          const txnData = JSON.parse(jsonString(receipt));
          const txnSuceeded = txnData.status === 1;
          const updatedStatus = txnSuceeded ? 'confirmed' : 'failed';
          await txn.update(origTxnDocRef, { status: updatedStatus, txnData });
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
    error('Txn: ' + origTxnHash + ' was rejected');
    // if the txn failed, err.receipt.status = 0
    if (err.receipt && err.receipt.status === 0) {
      error('Txn with hash: ' + origTxnHash + ' rejected');
      error(err);

      const txnData = JSON.parse(jsonString(err.receipt));
      batch.set(origTxnDocRef, { status: 'rejected', txnData }, { merge: true });
    }
    // if the txn failed due to replacement or cancellation or repricing
    if (err && err.reason && err.replacement) {
      error('Txn with hash: ' + origTxnHash + ' rejected with reason ' + err.reason);
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
      log('Writing replacement txn: ' + replacementTxnHash + ' to firestore');
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

export async function isValidNftcTxn(txnHash: string, chainId: string, actionType: 'fulfill' | 'cancel') {
  let isValid = true;
  const provider = getProvider(chainId);
  const txn = provider ? await provider.getTransaction(txnHash) : null;
  if (txn) {
    const to = txn.to;
    const txnChainId = txn.chainId;
    const data = txn.data;
    const value = txn.value;
    const openseaIface = new ethers.utils.Interface(openseaAbi as (JsonFragment | ethers.utils.Fragment)[]);
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
        const buyFeeRecipient = args[0][3];
        const sellFeeRecipient = args[0][10];
        if (
          buyFeeRecipient.toLowerCase() !== NFTC_FEE_ADDRESS.toLowerCase() &&
          sellFeeRecipient.toLowerCase() !== NFTC_FEE_ADDRESS.toLowerCase()
        ) {
          isValid = false;
        }
      } else if (addresses && actionType === 'cancel' && addresses.length === 7) {
        const feeRecipient = args[0][3];
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
  return isValid;
}

// order fulfill
export async function fulfillOrder(user: any, batch: any, payload: any) {
  // user is the taker of the order - either bought now or accepted offer
  // write to bought and sold and delete from listing, offer made, offer recvd
  /* cases in which order is fulfilled:
      1) listed an item and a buy now is made on it; order is the listing
      2) listed an item, offer received on it, offer is accepted; order is the offerReceived
      3) no listing made, but offer is received on it, offer is accepted; order is the offerReceived
    */
  try {
    const taker = user.trim().toLowerCase();
    const salePriceInEth = +payload.salePriceInEth;
    const side = +payload.side;
    const docId = payload.orderId.trim(); // preserve case
    const feesInEth = +payload.feesInEth;
    const txnHash = payload.txnHash;
    const maker = payload.maker.trim().toLowerCase();
    log(
      'Fulfilling order for taker',
      taker,
      'maker',
      maker,
      'sale price ETH',
      salePriceInEth,
      'fees in Eth',
      feesInEth,
      'and txn hash',
      txnHash
    );

    const numOrders = 1;

    if (side !== 0 && side !== 1) {
      error('Unknown order side ' + side + ' , not fulfilling it');
      return;
    }

    // record txn for maker
    const txnPayload = {
      txnHash,
      status: 'confirmed',
      salePriceInEth,
      actionType: payload.actionType.trim().toLowerCase(),
      createdAt: Date.now()
    };

    const makerTxnRef = firestore
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.USERS_COLL)
      .doc(maker)
      .collection(fstrCnstnts.TXNS_COLL)
      .doc(txnHash);

    batch.set(makerTxnRef, txnPayload, { merge: true });

    if (side === 0) {
      // taker accepted offerReceived, maker is the buyer

      // check if order exists
      const docSnap = await firestore
        .collection(fstrCnstnts.ROOT_COLL)
        .doc(fstrCnstnts.INFO_DOC)
        .collection(fstrCnstnts.USERS_COLL)
        .doc(maker)
        .collection(fstrCnstnts.OFFERS_COLL)
        .doc(docId)
        .get();
      if (!docSnap.exists) {
        log('No offer ' + docId + ' to fulfill');
        return;
      }

      const doc = docSnap.data();
      doc.taker = taker;
      doc.metadata.salePriceInEth = salePriceInEth;
      doc.metadata.feesInEth = feesInEth;
      doc.metadata.txnHash = txnHash;

      log('Item bought by ' + maker + ' sold by ' + taker);

      // write to bought by maker; multiple items possible
      await saveBoughtOrder(maker, doc, batch, numOrders);

      // write to sold by taker; multiple items possible
      await saveSoldOrder(taker, doc, batch, numOrders);

      // delete offerMade by maker
      await deleteOfferMadeWithId(docId, maker, batch);

      // delete listing by taker if it exists
      await deleteListingWithId(docId, taker, batch);

      // send email to maker that the offer is accepted
      prepareEmail(maker, doc, 'offerAccepted');
    } else if (side === 1) {
      // taker bought a listing, maker is the seller

      // check if order exists
      const docSnap = await firestore
        .collection(fstrCnstnts.ROOT_COLL)
        .doc(fstrCnstnts.INFO_DOC)
        .collection(fstrCnstnts.USERS_COLL)
        .doc(maker)
        .collection(fstrCnstnts.LISTINGS_COLL)
        .doc(docId)
        .get();
      if (!docSnap.exists) {
        log('No listing ' + docId + ' to fulfill');
        return;
      }

      const doc = docSnap.data();
      doc.taker = taker;
      doc.metadata.salePriceInEth = salePriceInEth;
      doc.metadata.feesInEth = feesInEth;
      doc.metadata.txnHash = txnHash;

      log('Item bought by ' + taker + ' sold by ' + maker);

      // write to bought by taker; multiple items possible
      await saveBoughtOrder(taker, doc, batch, numOrders);

      // write to sold by maker; multiple items possible
      await saveSoldOrder(maker, doc, batch, numOrders);

      // delete listing from maker
      await deleteListingWithId(docId, maker, batch);

      // send email to maker that the item is purchased
      prepareEmail(maker, doc, 'itemPurchased');
    }
  } catch (err) {
    error('Error in fufilling order');
    error(err);
  }
}

export async function cancelListing(user: any, batch: any, docId: string) {
  log('Canceling listing for user', user);
  try {
    // check if listing exists first
    const listingRef = firestore
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.USERS_COLL)
      .doc(user)
      .collection(fstrCnstnts.LISTINGS_COLL)
      .doc(docId);
    const doc = await listingRef.get();
    if (!doc.exists) {
      log('No listing ' + docId + ' to delete');
      return;
    }
    // delete
    await deleteListing(batch, listingRef);
  } catch (err) {
    error('Error cancelling listing');
    error(err);
  }
}

async function deleteListing(batch: any, docRef: any) {
  const doc = await docRef.get();
  if (!doc.exists) {
    log('No listing to delete: ' + docRef.id);
    return;
  }
  const listing = doc.id;
  log('Deleting listing', listing);
  const user = doc.data().maker;
  const hasBonus = doc.data().metadata.hasBonusReward;
  const numOrders = 1;

  // delete listing
  batch.delete(doc.ref);

  // update num collection listings
  try {
    const tokenAddress = doc.data().metadata.asset.address;
    firestore
      .collection(fstrCnstnts.COLLECTION_LISTINGS_COLL)
      .doc(tokenAddress)
      .set({ numListings: firebaseAdmin.firestore.FieldValue.increment(-1 * numOrders) }, { merge: true });
  } catch (err) {
    error('Error updating root collection data on delete listing');
    error(err);
  }
  // update num user listings
  updateNumOrders(batch, user, -1 * numOrders, hasBonus, 1);
}

async function cancelOffer(user: any, batch: any, docId: string) {
  log('Canceling offer for user', user);
  try {
    // check if offer exists first
    const offerRef = firestore
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.USERS_COLL)
      .doc(user)
      .collection(fstrCnstnts.OFFERS_COLL)
      .doc(docId);
    const doc = await offerRef.get();
    if (!doc.exists) {
      log('No offer ' + docId + ' to delete');
      return;
    }
    // delete
    await deleteOffer(batch, offerRef);
  } catch (err) {
    error('Error cancelling offer');
    error(err);
  }
}

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
  // @ts-ignore
  const purchasesTotal = bn(userInfo.purchasesTotal).plus(salePriceInEth).toString();
  // @ts-ignore
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
  // @ts-ignore
  const salesTotal = bn(userInfo.salesTotal).plus(salePriceInEth).toString();
  // @ts-ignore
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

export async function deleteOfferMadeWithId(id: string, user: any, batch: any) {
  log('Deleting offer with id', id, 'from user', user);
  const docRef = firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .collection(fstrCnstnts.OFFERS_COLL)
    .doc(id);
  await deleteOffer(batch, docRef);
}

export async function deleteListingWithId(id: string, user: any, batch: any) {
  log('Deleting listing with id', id, 'from user', user);
  const docRef = firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .collection(fstrCnstnts.LISTINGS_COLL)
    .doc(id);
  await deleteListing(batch, docRef);
}

export function getEmptyUserProfileInfo() {
  return {
    email: {
      address: '',
      verified: false,
      subscribed: false
    }
  };
}

// right now emails are sent when an item is purchased, offer is made or an offer is accepted
export async function prepareEmail(user: any, order: any, type: any) {
  log('Preparing to send email to user', user, 'for action type', type);
  const userDoc = await firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .get();

  let profileInfo = getEmptyUserProfileInfo();

  if (userDoc.data()) {
    profileInfo = {
      ...profileInfo,
      ...userDoc.data().profileInfo
    };
  }

  const email = profileInfo.email.address;
  const verified = profileInfo.email.verified;
  const subscribed = profileInfo.email.subscribed;
  if (!email || !verified || !subscribed) {
    log('Not sending email as it is not verfied or subscribed or not found');
    return;
  }

  const price = order.metadata.basePriceInEth;

  let subject = '';
  let link = SITE_BASE;
  if (type === 'offerMade') {
    subject = 'You received a ' + price + ' ETH offer at Infinity';
    link += '/offers-received';
  } else if (type === 'offerAccepted') {
    subject = 'Your offer of ' + price + ' ETH has been accepted at Infinity';
    link += '/purchases';
  } else if (type === 'itemPurchased') {
    subject = 'Your item has been purchased for ' + price + ' ETH at Infinity';
    link += '/sales';
  } else {
    error('Cannot prepare email for unknown action type');
    return;
  }

  const html = '<p>See it here:</p> ' + '<a href=' + link + ' target="_blank">' + link + '</a>';
  // send email
  sendEmail(email, subject, html);
}

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    type: 'OAuth2',
    user: INFINITY_EMAIL,
    serviceClient: mailCreds.client_id,
    privateKey: mailCreds.private_key
  }
});

export function sendEmail(to: string, subject: string, html: string) {
  log('Sending email to', to);

  const mailOptions = {
    from: INFINITY_EMAIL,
    to,
    subject,
    html
  };

  transporter.sendMail(mailOptions).catch((err) => {
    error('Error sending email');
    error(err);
  });
}
