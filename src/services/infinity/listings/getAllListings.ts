import { firestore } from 'container';
import { OrderDirection } from '@infinityxyz/lib/types/core';
import { error, firestoreConstants, log } from '@infinityxyz/lib/utils';
import { getOrdersResponse } from '../utils';

export async function getAllListings(
  sortByPriceDirection: OrderDirection,
  startAfterPrice: string,
  startAfterMillis: string,
  startAfterBlueCheck: string,
  limit: number
) {
  log('Getting all listings');

  try {
    let query = firestore.db
      .collectionGroup(firestoreConstants.LISTINGS_COLL)
      .orderBy('metadata.hasBlueCheck', OrderDirection.Descending)
      .orderBy('metadata.basePriceInEth', sortByPriceDirection)
      .orderBy('metadata.createdAt', OrderDirection.Descending);

    if (startAfterBlueCheck === undefined) {
      query = query.startAfter(true, startAfterPrice, startAfterMillis);
    } else {
      const startAfterBlueCheckBool = startAfterBlueCheck === 'true';
      query = query.startAfter(startAfterBlueCheckBool, startAfterPrice, startAfterMillis);
    }

    const data = await query.limit(limit).get();

    return getOrdersResponse(data);
  } catch (err) {
    error('Failed to get listings');
    error(err);
  }
}
