import firebaseAdmin from 'firebase-admin';
import { firestore } from 'container';
import { fstrCnstnts } from '../../../constants';
import { updateNumOrders } from '../orders/updateNumOrders';
import { error, log } from '@infinityxyz/lib/utils';

export async function deleteListing(batch: any, docRef: any) {
  const doc = await docRef.get();
  if (!doc.exists) {
    log(`No listing to delete: ${docRef.id}`);
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
    await firestore
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
