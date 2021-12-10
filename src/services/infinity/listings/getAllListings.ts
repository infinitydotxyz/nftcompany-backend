import { firestore } from '@base/container';
import { OrderDirection } from '@base/types/Queries';
import { fstrCnstnts } from '@constants';
import { getOrdersResponse } from '@routes/u/:user/listings';
import { error, log } from '@utils/logger';

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
      .collectionGroup(fstrCnstnts.LISTINGS_COLL)
      .orderBy('metadata.hasBlueCheck', 'desc')
      .orderBy('metadata.basePriceInEth', sortByPriceDirection)
      .orderBy('metadata.createdAt', 'desc');

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
