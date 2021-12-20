import { fstrCnstnts } from '@constants';
import { error, log } from '@utils/logger';
import { getUserInfoRef } from '../users/getUser';
import { deleteOffer } from './deleteOffer';

export async function cancelOffer(userAddress: string, batch: any, docId: string) {
  log('Canceling offer for user', userAddress);
  try {
    // check if offer exists first
    const offerRef = getUserInfoRef(userAddress).collection(fstrCnstnts.OFFERS_COLL).doc(docId);
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
