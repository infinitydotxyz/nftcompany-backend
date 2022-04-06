import { firestore } from 'container';
import { fstrCnstnts } from '../../../constants';
import { log } from '@infinityxyz/lib/utils';
import { deleteListing } from './deleteListing';

export async function deleteListingWithId(id: string, user: any, batch: any) {
  log('Deleting listing with id', id, 'from user', user);
  const docRef = firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .collection(fstrCnstnts.LISTINGS_COLL)
    .doc(id);
  await deleteListing(batch, docRef);
}
