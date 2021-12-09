import { firestore } from '@base/container.js';
import { fstrCnstnts } from '@constants';
import { normalizeAddress } from '@utils/formatters.js';
import { Router } from 'express';
import { getVerifiedBonusReward } from './:tokenAddress/verifiedBonusReward.js';
const router = Router();

router.get('/:tokenAddress/verifiedBonusReward', getVerifiedBonusReward);

/**
 *
 * @param address of the token to query
 */
export async function hasBonusReward(address: string): Promise<boolean> {
  let tokenAddress = normalizeAddress(address);
  const doc = await firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.BONUS_REWARD_TOKENS_COLL)
    .doc(tokenAddress)
    .get();
  return doc.exists;
}

/**
 * @param address of the token to query
 * @returns whether the token is verified
 */
export async function isTokenVerified(address: string): Promise<boolean> {
  const tokenAddress = normalizeAddress(address);
  const doc = await firestore.collection(fstrCnstnts.ALL_COLLECTIONS_COLL).doc(tokenAddress).get();
  if (doc.exists) {
    const hasBlueCheck = doc.get('hasBlueCheck');
    if (hasBlueCheck) {
      return true;
    }
  }
  return false;
}

export default router;
