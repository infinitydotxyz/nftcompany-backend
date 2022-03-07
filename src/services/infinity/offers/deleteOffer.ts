import { log } from 'utils/logger';
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

  // delete offer
  batch.delete(doc.ref);

  // update num user offers
  updateNumOrders(batch, user, -1 * numOrders, hasBonus, 0);
}
