import { firestoreConstants, log } from '@infinityxyz/lib/utils';
import { firestore } from 'container';
import {
  addVerifiedCollectionId,
  removeVerifiedCollectionId
} from 'services/infinity/collections/getVerifiedCollectionIds';

let setupAllCollectionsListenerDone = false;

/*
 * Set up DB Listener on 'ALL_COLLECTIONS_COLL' to update the cache.
 * todo: this needs to change to a listener on the `collections` collection.
 */
export function setupAllCollectionsListener() {
  if (setupAllCollectionsListenerDone) {
    return;
  }
  const coll = firestore.collection(firestoreConstants.COLLECTIONS_COLL);

  // Listening to collection changes
  coll.onSnapshot(
    (snapshot) => {
      log(`Collection changed: ${firestoreConstants.COLLECTIONS_COLL}`);

      // From the 2nd+ callback run: (skip the 1st one, which is for full changes)
      if (setupAllCollectionsListenerDone) {
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();

          if (change.type === 'added' || change.type === 'modified') {
            if (data.hasBlueCheck) {
              addVerifiedCollectionId(data?.address);
            } else {
              removeVerifiedCollectionId(data?.address);
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
