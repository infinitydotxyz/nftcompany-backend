import { firestore } from '@base/container';
import { fstrCnstnts } from '@base/constants';

export function getFeaturedCollectionsRef(limit: number) {
  return firestore.collection(fstrCnstnts.FEATURED_COLL).limit(limit);
}
