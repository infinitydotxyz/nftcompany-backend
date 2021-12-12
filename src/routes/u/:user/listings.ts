import { OrderDirection } from '@base/types/Queries';
import { StatusCode } from '@base/types/StatusCode';
import { getUserListingsRef } from '@services/infinity/listings/getUserListing';
import { getOrdersResponse } from '@services/infinity/utils';
import { error } from '@utils/logger';
import { parseQueryFields } from '@utils/parsers';
import { Request, Response } from 'express';

// fetch listings of user
export const getUserListings = async (req: Request<{ user: string }>, res: Response) => {
  const user = (`${req.params.user}` || '').trim().toLowerCase();
  const {
    limit,
    startAfterMillis,
    error: err
  }: { limit?: number; startAfterMillis?: number; error?: Error } = parseQueryFields(
    res,
    req,
    ['limit', 'startAfterMillis'],
    ['50', `${Date.now()}`]
  );
  if (err) {
    return;
  }
  if (!user) {
    error('Empty user');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }

  try {
    const data = await getUserListingsRef(user)
      .orderBy('metadata.createdAt', OrderDirection.Descending)
      .startAfter(startAfterMillis)
      .limit(limit)
      .get();
    const resp = getOrdersResponse(data);
    res.send(resp);
  } catch (err) {
    error('Failed to get user listings for user ' + user);
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};
