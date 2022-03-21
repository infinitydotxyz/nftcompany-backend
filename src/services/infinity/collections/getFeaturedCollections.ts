import { firestoreConstants } from '@infinityxyz/lib/utils';
import { firestore } from 'container';

export function getFeaturedCollectionsRef(limit: number) {
  return firestore.collection(firestoreConstants.FEATURED_COLL).limit(limit);
}
