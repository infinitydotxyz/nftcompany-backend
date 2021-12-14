import { firestore } from '@base/container';
import { fstrCnstnts } from '@constants';
import { error, log } from '@utils/logger';
import { prepareEmail } from '../email/prepareEmail';
import { deleteListingWithId } from '../listings/deleteListingWithId';
import { deleteOfferMadeWithId } from '../offers/deleteOfferMadeWithId';
import { saveBoughtOrder } from './saveBoughtOrder';
import { saveSoldOrder } from './saveSoldOrder';

// order fulfill
export async function fulfillOrder(user: string, batch: any, payload: any) {
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

      const doc = docSnap?.data?.();
      if (!docSnap.exists || !doc) {
        log('No offer ' + docId + ' to fulfill');
        return;
      }

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
      void prepareEmail(maker, doc, 'offerAccepted');
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
      const doc = docSnap?.data?.();
      if (!docSnap.exists || !doc) {
        log('No listing ' + docId + ' to fulfill');
        return;
      }

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
      void prepareEmail(maker, doc, 'itemPurchased');
    }
  } catch (err) {
    error('Error in fufilling order');
    error(err);
  }
}
