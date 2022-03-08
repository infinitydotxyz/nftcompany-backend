import { firestore } from 'container';
import { fstrCnstnts } from '../../../constants';
import { trimLowerCase } from '@infinityxyz/lib/utils';

/**
 *
 * @param address of the token to query
 */
export async function hasBonusReward(address: string): Promise<boolean> {
  const tokenAddress = trimLowerCase(address);
  const doc = await firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.BONUS_REWARD_TOKENS_COLL)
    .doc(tokenAddress)
    .get();
  return doc.exists;
}
