import { firestore } from '@base/container';
import { fstrCnstnts } from '@base/constants';

export function getUserInfoRef(userAddress: string) {
  return firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(userAddress);
}
