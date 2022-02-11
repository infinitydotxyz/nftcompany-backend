import { firestore } from '@base/container';
import { fstrCnstnts } from '@base/constants';
import { log } from '@utils/logger';

let idsArray: string[] = []; // cached collection id array.

// Get verified collection IDs. Return an array of ids. 
export async function getVerifiedCollectionIds() {
  if (idsArray.length > 0) {
    return idsArray; // return cached data.
  } 
  log('Fetching verified collection ids');
  
  const query = firestore
    .collection(fstrCnstnts.ALL_COLLECTIONS_COLL)
    .select('hasBlueCheck')
    .where('hasBlueCheck', '==', true);

  const data = await query.get();

  idsArray = (data?.docs || []).map((doc) => {
    return doc.id;
  });
  return idsArray;
}
