import { error, firestoreConstants, log } from '@infinityxyz/lib/utils';
import { getUserInfoRef } from '../users/getUser';
import { deleteListing } from './deleteListing';

export async function cancelListing(userAddress: string, batch: any, docId: string) {
  log('Canceling listing for user', userAddress);
  try {
    // check if listing exists first
    const listingRef = getUserInfoRef(userAddress).collection(firestoreConstants.LISTINGS_COLL).doc(docId);
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
