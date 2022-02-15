import { log } from '@utils/logger';
import { firestore } from '@base/container';
import { fstrCnstnts } from '@base/constants';
import {
  addVerifiedCollectionId,
  removeVerifiedCollectionId
} from '@services/infinity/collections/getVerifiedCollectionIds';

let setupAllCollectionsListenerDone = false;

/*
 * set up DB Listener on 'ALL_COLLECTIONS_COLL' to update the cache.
 */
export function setupAllCollectionsListener() {
  if (setupAllCollectionsListenerDone) {
    return;
  }
  const coll = firestore.collection(fstrCnstnts.ALL_COLLECTIONS_COLL);

  // listening to collection changes
  coll.onSnapshot(
    async (snapshot) => {
      log(`Collection changed: ${fstrCnstnts.ALL_COLLECTIONS_COLL}`);

      // from the 2nd+ callback run: (skip the 1st one, which is for full changes)
      if (setupAllCollectionsListenerDone) {
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();

          if (change.type === 'added' || change.type === 'modified') {
            if (data.hasBlueCheck) {
              addVerifiedCollectionId(data?.address);
            }
          }
          if (change.type === 'removed') {
            removeVerifiedCollectionId(data?.address);
          }
        });
      }
      setupAllCollectionsListenerDone = true;
    },
    (err) => {
      console.log(`Encountered error in onSnapshot: `, err);
    }
  );
}
