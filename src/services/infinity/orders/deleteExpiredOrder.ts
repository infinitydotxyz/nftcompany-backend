import { firestore } from 'container';
import { error, log } from '@infinityxyz/lib/utils';
import { deleteListing } from '../listings/deleteListing';
import { deleteOffer } from '../offers/deleteOffer';

export async function deleteExpiredOrder(doc: any) {
  log('Deleting expired order', doc.id);
  const order = doc.data();
  const side = +order.side;
  const batch = firestore.db.batch();
  if (side === 1) {
    // Listing
    await deleteListing(batch, doc.ref);
  } else if (side === 0) {
    // Offer
    await deleteOffer(batch, doc.ref);
  } else {
    error('Unknown order type', doc.id);
  }
  // Commit batch
  log('Committing delete expired order batch');
  batch
    .commit()
    .then(() => {
      // No op
    })
    .catch((err) => {
      error('Failed to commit delete expired order batch');
      error(err);
    });
}
