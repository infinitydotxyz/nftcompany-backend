import { firestore } from 'container';
import { error, firestoreConstants } from '@infinityxyz/lib/utils';

export async function resetCollectionStats() {
  try {
    const docs = firestore.db.collectionGroup(firestoreConstants.COLLECTION_STATS_COLL).orderBy(`averagePrice`, 'asc');

    const batch = firestore.db.batch();

    const results = await docs.get();
    for (const doc of results.docs) {
      batch.delete(doc.ref);
    }

    await batch.commit();
  } catch (err) {
    error('failed to delete collection stats');
    error(err);
  }
}
