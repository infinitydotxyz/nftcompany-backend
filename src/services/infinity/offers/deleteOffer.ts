import { log } from '@infinityxyz/lib/utils';
import { updateNumOrders } from '../orders/updateNumOrders';

export async function deleteOffer(batch: any, docRef: any) {
  const doc = await docRef.get();
  if (!doc.exists) {
    log(`No offer to delete: ${docRef.id}`);
    return;
  }
  const offer = doc.id;
  log('Deleting offer', offer);
  const user = doc.data().maker;
  const hasBonus = doc.data().metadata.hasBonusReward;
  const numOrders = 1;

  // Delete offer
  batch.delete(doc.ref);

  // Update num user offers
  updateNumOrders(batch, user, -1 * numOrders, hasBonus, 0);
}
