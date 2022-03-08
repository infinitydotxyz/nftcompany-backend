import { firestore } from 'container';
import { WyvernTraitWithValues } from '@infinityxyz/lib/types/protocols/wyvern';
import { fstrCnstnts } from '../../../constants';
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
