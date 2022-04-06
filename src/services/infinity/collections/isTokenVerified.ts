import { firestore } from 'container';
import { firestoreConstants, getCollectionDocId } from '@infinityxyz/lib/utils';

/**
 * @param address of the token to query
 * @returns whether the token is verified
 */
export async function isTokenVerified(collection: { collectionAddress: string; chainId: string }): Promise<boolean> {
  const docId = getCollectionDocId(collection);
  const doc = await firestore.collection(firestoreConstants.COLLECTIONS_COLL).doc(docId).get();
  if (doc.exists) {
    const hasBlueCheck = doc.get('hasBlueCheck');
    if (hasBlueCheck) {
      return true;
    }
  }
  return false;
}
