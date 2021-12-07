import { fstrCnstnts } from '@constants';
import { firestore } from '../container.js';

export default class CollectionDAO {
  private address: string;

  constructor(address: string) {
    this.address = address.trim().toLowerCase();
  }

  /**
   *
   * @param address of the token to query
   */
  async hasBonusReward(): Promise<boolean> {
    const doc = await firestore
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.BONUS_REWARD_TOKENS_COLL)
      .doc(this.address)
      .get();
    return doc.exists;
  }

  /**
   * @param address of the token to query
   * @returns whether the token is verified
   */
  async isTokenVerified(): Promise<boolean> {
    const doc = await firestore.collection(fstrCnstnts.ALL_COLLECTIONS_COLL).doc(this.address).get();
    if (doc.exists) {
      const hasBlueCheck = doc.get('hasBlueCheck');
      if (hasBlueCheck) {
        return true;
      }
    }
    return false;
  }
}
