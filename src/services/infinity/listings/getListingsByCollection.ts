import { firestore } from 'container';
import { OrderDirection } from '@infinityxyz/lib/types/core';
import { fstrCnstnts } from '../../../constants';
import { error } from '@infinityxyz/lib/utils';
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
