import { fstrCnstnts } from '../../../constants';
import { error, log } from '@infinityxyz/lib/utils';
import { getUserInfoRef } from '../users/getUser';
import { deleteOffer } from './deleteOffer';

export async function cancelOffer(userAddress: string, batch: any, docId: string) {
  log('Canceling offer for user', userAddress);
  try {
    // Check if offer exists first
    const offerRef = getUserInfoRef(userAddress).collection(fstrCnstnts.OFFERS_COLL).doc(docId);
    const doc = await offerRef.get();
    if (!doc.exists) {
      log('No offer ' + docId + ' to delete');
      return;
    }
    // Delete
    await deleteOffer(batch, offerRef);
  } catch (err) {
    error('Error cancelling offer');
    error(err);
  }
}
