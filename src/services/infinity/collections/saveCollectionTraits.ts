import { firestore } from '@base/container';
import { RawTraitWithValues } from '@base/types/OSNftInterface';
import { fstrCnstnts } from '@constants';
import { ethers } from 'ethers';

export async function saveCollectionTraits(contractAddress: string, traits: RawTraitWithValues[]) {
  if (!ethers.utils.isAddress(contractAddress)) {
    return { success: false, error: new Error('invalid address') };
  }
  try {
    await firestore.collection(fstrCnstnts.ALL_COLLECTIONS_COLL).doc(contractAddress).set({ traits }, { merge: true });
    return { success: true };
  } catch (err) {
    return {
      successs: false,
      error: err
    };
  }
}