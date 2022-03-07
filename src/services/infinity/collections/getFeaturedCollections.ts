import { firestore } from 'container';
import { fstrCnstnts } from '../../../constants';

export function getFeaturedCollectionsRef(limit: number) {
  return firestore.collection(fstrCnstnts.FEATURED_COLL).limit(limit);
}
