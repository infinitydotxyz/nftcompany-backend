import { firestore } from 'container';
import { fstrCnstnts } from '../../../constants';

export function getUserInfoRef(userAddress: string) {
  return firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(userAddress);
}
