import { log } from '@utils/logger';
import { firestore } from '@base/container';
import { fstrCnstnts } from '@base/constants';
import { getVerifiedCollectionIds } from '@services/infinity/collections/getVerifiedCollectionIds';

export function setupDbListeners() {
  const coll = firestore.collection(fstrCnstnts.ALL_COLLECTIONS_COLL);

  // listening to collection changes (fstrCnstnts.ALL_COLLECTIONS_COLL)
  coll.onSnapshot(
    async () => {
      log(`Collection change listener: ${fstrCnstnts.ALL_COLLECTIONS_COLL}`);
      await getVerifiedCollectionIds({ skipCache: true }); // re-fetch verified collection Ids
    },
    (err) => {
      console.log(`Encountered error: `, err);
    }
  );
}
