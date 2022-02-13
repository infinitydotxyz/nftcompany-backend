import { log } from '@utils/logger';
import { firestore } from '@base/container';
import { fstrCnstnts } from '@base/constants';
import { getVerifiedCollectionIds } from '@services/infinity/collections/getVerifiedCollectionIds';

export function setupDbListeners() {
  const coll = firestore.collection(fstrCnstnts.ALL_COLLECTIONS_COLL);

  // listening to collection changes (fstrCnstnts.ALL_COLLECTIONS_COLL)
  coll.onSnapshot(
    () => {
      getVerifiedCollectionIds({ skipCache: true }); // re-fetch verified collection Ids
      log(`Collection changed: ${fstrCnstnts.ALL_COLLECTIONS_COLL}`);
    },
    (err) => {
      console.log(`Encountered error: ${err}`);
    }
  );
}
