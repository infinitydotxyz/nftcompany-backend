import { firestore } from 'container';
import { fstrCnstnts } from '../../../constants';
import { normalizeAddress } from 'utils/formatters';

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
