import { firestore } from '@base/container';
import { fstrCnstnts } from '@constants';
import { log } from '@utils/logger';
import { deleteOffer } from './deleteOffer';

export async function deleteOfferMadeWithId(id: string, user: any, batch: any) {
  log('Deleting offer with id', id, 'from user', user);
  const docRef = firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .collection(fstrCnstnts.OFFERS_COLL)
    .doc(id);
  await deleteOffer(batch, docRef);
}
