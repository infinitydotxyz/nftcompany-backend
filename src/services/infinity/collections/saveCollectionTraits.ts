import { firestore } from 'container';
import { WyvernTraitWithValues } from '@infinityxyz/lib/types/protocols/wyvern';
import { firestoreConstants, getCollectionDocId } from '@infinityxyz/lib/utils';

export async function saveCollectionTraits(
  collection: { collectionAddress: string; chainId: string },
  traits: WyvernTraitWithValues[]
) {
  try {
    const docId = getCollectionDocId(collection);
    await firestore.collection(firestoreConstants.COLLECTIONS_COLL).doc(docId).set({ traits }, { merge: true });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err
    };
  }
}
