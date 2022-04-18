import { firestore } from 'container';
import { firestoreConstants, log } from '@infinityxyz/lib/utils';
import { setupAllCollectionsListener } from 'utils/dblisteners';

export let verifiedCollectionIds: any;
let isFetching = false;

// Get verified collection IDs. Return an array of ids.
export async function getVerifiedCollectionIds() {
  if (isFetching) {
    return [];
  }

  try {
    if (verifiedCollectionIds && verifiedCollectionIds.length > 0) {
      return verifiedCollectionIds; // Return cached data if any.
    }
    isFetching = true;
    log('getVerifiedCollectionIds: fetching verified collection ids');
    const query = firestore
      .collection(firestoreConstants.COLLECTIONS_COLL)
      .select('hasBlueCheck')
      .where('hasBlueCheck', '==', true);

    const data = await query.get();

    verifiedCollectionIds = (data?.docs || []).map((doc) => {
      return doc.id;
    });

    setupAllCollectionsListener(); // Listen to db changes to update cache.
  } catch (err: any) {
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
