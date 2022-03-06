import { firestore } from '@base/container';
import { WyvernTraitWithValues } from '@infinityxyz/types/protocols/wyvern';
import { fstrCnstnts } from '@base/constants';
import { ethers } from 'ethers';

export async function saveCollectionTraits(contractAddress: string, traits: WyvernTraitWithValues[]) {
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
