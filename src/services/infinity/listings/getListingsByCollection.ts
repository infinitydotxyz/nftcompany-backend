import { firestore } from '@base/container';
import { fstrCnstnts } from '@constants';
import { error } from '@utils/logger';
import { getOrdersResponse } from '../utils';

export async function getListingsByCollection(
  startAfterBlueCheck: boolean | string,
  startAfterSearchCollectionName: boolean,
  limit: number
) {
  try {
    let startAfterBlueCheckBool = true;
    if (startAfterBlueCheck !== undefined) {
      startAfterBlueCheckBool = startAfterBlueCheck === 'true';
    }

    const snapshot = await firestore.db
      .collectionGroup(fstrCnstnts.COLLECTION_LISTINGS_COLL)
      .orderBy('metadata.hasBlueCheck', 'desc')
      .orderBy('metadata.asset.searchCollectionName', 'asc')
      .startAfter(startAfterBlueCheckBool, startAfterSearchCollectionName)
      .limit(limit)
      .get();

    return getOrdersResponse(snapshot);
  } catch (err) {
    error('Failed to get listings by collection from firestore');
    error(err);
  }
}
