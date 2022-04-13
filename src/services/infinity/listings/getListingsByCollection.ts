import { firestore } from 'container';
import { OrderDirection } from '@infinityxyz/lib/types/core';
import { error, firestoreConstants } from '@infinityxyz/lib/utils';
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
      .collectionGroup(firestoreConstants.LISTINGS_COLL)
      .orderBy('metadata.hasBlueCheck', OrderDirection.Descending)
      .orderBy('metadata.asset.searchCollectionName', OrderDirection.Ascending)
      .startAfter(startAfterBlueCheckBool, startAfterSearchCollectionName)
      .limit(limit)
      .get();

    return getOrdersResponse(snapshot);
  } catch (err: any) {
    error('Failed to get listings by collection from firestore');
    error(err);
  }
}
