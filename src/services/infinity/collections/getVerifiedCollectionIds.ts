import { firestore } from 'container';
import { fstrCnstnts } from '../../../constants';
import { log } from '@infinityxyz/lib/utils';
import { setupAllCollectionsListener } from 'utils/dblisteners';

export let verifiedCollectionIds;
let isFetching = false;

// Get verified collection IDs. Return an array of ids.
export async function getVerifiedCollectionIds() {
  if (isFetching) {
    return [];
  }

  try {
    if (verifiedCollectionIds && verifiedCollectionIds.length > 0) {
      return verifiedCollectionIds; // return cached data if any.
    }
    isFetching = true;
    log('getVerifiedCollectionIds: fetching verified collection ids');
    const query = firestore
      .collection(fstrCnstnts.COLLECTIONS_COLL)
      .select('hasBlueCheck')
      .where('hasBlueCheck', '==', true);

    const data = await query.get();

    verifiedCollectionIds = (data?.docs || []).map((doc) => {
      return doc.id;
    });

    setupAllCollectionsListener(); // listen to db changes to update cache.
  } catch (err) {
    throw new Error(`error in getVerifiedCollectionIds ${err}`);
  }
  isFetching = false;
  return verifiedCollectionIds;
}

export function addVerifiedCollectionId(newId: string) {
  if (newId && !verifiedCollectionIds.includes(newId)) {
    verifiedCollectionIds.push(newId);
  }
}

export function removeVerifiedCollectionId(removingId: string) {
  if (removingId && verifiedCollectionIds.includes(removingId)) {
    verifiedCollectionIds = verifiedCollectionIds.filter((id: string) => id !== removingId);
  }
}
