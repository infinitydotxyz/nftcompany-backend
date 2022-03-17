import { firestore } from 'container';
import { trimLowerCase } from '@infinityxyz/lib/utils';

/**
 *
 * @param address of the token to query
 */
export async function hasBonusReward(address: string): Promise<boolean> {
  const tokenAddress = trimLowerCase(address);
  const doc = await firestore.collection('root').doc('info').collection('bonusRewardTokens').doc(tokenAddress).get();
  return doc.exists;
}
