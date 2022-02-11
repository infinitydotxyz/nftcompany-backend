import { firestore } from '@base/container';
import { fstrCnstnts } from '@base/constants';
import { log } from '@utils/logger';
import { cacheGet, cacheSet } from '@utils/cache'

const COLLECTION_IDS_KEY = 'COLLECTION_IDS_KEY';

// Get verified collection IDs. Return an array of ids. 
export async function getVerifiedCollectionIds() {
  let idsArray = cacheGet(COLLECTION_IDS_KEY) as string[];
  if (idsArray && idsArray.length > 0) {
    return idsArray; // return cached data if any.
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
  cacheSet(COLLECTION_IDS_KEY, idsArray);
  return idsArray;
}
