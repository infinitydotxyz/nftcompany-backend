import { firestore } from '@base/container';
import { OrderSide } from '@base/types/NftInterface';
import { fstrCnstnts } from '@base/constants';
import { log } from '@utils/logger';
import firebaseAdmin from 'firebase-admin';

export function updateNumOrders(batch: any, user: string, numOrders: number, hasBonus: boolean, side: OrderSide) {
  log('Updating user stats');

  const ref = firestore.db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user);
  if (side === 0) {
    // offers
    batch.set(ref, { numOffers: firebaseAdmin.firestore.FieldValue.increment(numOrders) }, { merge: true });
    if (hasBonus) {
      batch.set(ref, { numBonusOffers: firebaseAdmin.firestore.FieldValue.increment(numOrders) }, { merge: true });
    }
  } else if (side === 1) {
    // listings
    batch.set(ref, { numListings: firebaseAdmin.firestore.FieldValue.increment(numOrders) }, { merge: true });
    if (hasBonus) {
      batch.set(ref, { numBonusListings: firebaseAdmin.firestore.FieldValue.increment(numOrders) }, { merge: true });
    }
  }
}
