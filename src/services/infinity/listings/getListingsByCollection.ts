import { firestore } from '@base/container';
import { OrderDirection } from '@infinityxyz/types/core';
import { fstrCnstnts } from '@base/constants';
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
      .orderBy('metadata.hasBlueCheck', OrderDirection.Descending)
      .orderBy('metadata.asset.searchCollectionName', OrderDirection.Ascending)
      .startAfter(startAfterBlueCheckBool, startAfterSearchCollectionName)
      .limit(limit)
      .get();

    return getOrdersResponse(snapshot);
  } catch (err) {
    error('Failed to get listings by collection from firestore');
    error(err);
  }
}
