import { firestore } from '@base/container';
import { fstrCnstnts } from '@constants';
import { normalizeAddress } from '@utils/formatters';

/**
 *
 * @param address of the token to query
 */
export async function hasBonusReward(address: string): Promise<boolean> {
  const tokenAddress = normalizeAddress(address);
  const doc = await firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.BONUS_REWARD_TOKENS_COLL)
    .doc(tokenAddress)
    .get();
  return doc.exists;
}
