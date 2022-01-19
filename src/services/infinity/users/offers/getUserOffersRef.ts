import { fstrCnstnts } from '@base/constants';
import { getUserInfoRef } from '../getUser';

export function getUserOffersRef(userAddress: string) {
  return getUserInfoRef(userAddress).collection(fstrCnstnts.OFFERS_COLL);
}
