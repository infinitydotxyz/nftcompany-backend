import { OrderDirection } from '@base/types/Queries';
import { StatusCode } from '@base/types/StatusCode';
import { getUserListingsRef } from '@services/infinity/listings/getUserListing';
import { getOrdersResponse } from '@services/infinity/utils';
import { error } from '@utils/logger';
import { parseQueryFields } from '@utils/parsers';
import { Request, Response } from 'express';

// fetch listings of user
export const getUserListings = async (req: Request<{ user: string }>, res: Response) => {
  const { listType, priceMin = '', priceMax = '' } = req.query;
  const user = (`${req.params.user}` || '').trim().toLowerCase();
  const queries = parseQueryFields(res, req, ['limit', 'startAfterMillis'], ['50', `${Date.now()}`]);
  if ('error' in queries) {
    return;
  }
  if (!user) {
    error('Empty user');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }

  try {
    let queryRef: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = getUserListingsRef(user);

    if (priceMin) {
      queryRef = queryRef.where('metadata.basePriceInEth', '>=', +priceMin);
    }
    if (priceMax) {
      queryRef = queryRef.where('metadata.basePriceInEth', '<=', +priceMax);
    }

    if (listType) {
      queryRef = queryRef.where('metadata.listingType', '==', listType);
    }

    if (+priceMin || +priceMax) {
      queryRef = queryRef
        .orderBy('metadata.basePriceInEth', OrderDirection.Ascending)
        .orderBy('metadata.createdAt', OrderDirection.Descending)
        .startAfter(0, queries.startAfterMillis); // orderBy & startAfter fields should match.
    } else {
      queryRef = queryRef.orderBy('metadata.createdAt', OrderDirection.Descending).startAfter(queries.startAfterMillis);
    }

    queryRef = queryRef.limit(queries.limit);
    const data = await queryRef.get();
    const resp = getOrdersResponse(data);
    res.send(resp);
  } catch (err) {
    error('Failed to get user listings for user ' + user);
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};
