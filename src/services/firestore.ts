import { fstrCnstnts } from '@constants';
import { firestore } from '../container.js';

export async function isTokenVerified(address: string) {
  const tokenAddress = address.trim().toLowerCase();
  const doc = await firestore.collection(fstrCnstnts.ALL_COLLECTIONS_COLL).doc(tokenAddress).get();
  if (doc.exists) {
    const hasBlueCheck = doc.get('hasBlueCheck');
    if (hasBlueCheck) {
      return true;
    }
  }
  return false;
}

export async function hasBonusReward(address: string) {
  const doc = await firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.BONUS_REWARD_TOKENS_COLL)
    .doc(address)
    .get();
  return doc.exists;
}
