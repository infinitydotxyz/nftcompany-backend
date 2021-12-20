import { OrderDirection } from '@base/types/Queries';
import { StatusCode } from '@base/types/StatusCode';
import { getUserOffersRef } from '@services/infinity/users/offers/getUserOffersRef';
import { getOrdersResponse } from '@services/infinity/utils';
import { error } from '@utils/logger';
import { parseQueryFields } from '@utils/parsers';
import { Request, Response } from 'express';

// fetch offer made by user
export const getUserOffersMade = async (req: Request<{ user: string }>, res: Response) => {
  const user = (`${req.params.user}` || '').trim().toLowerCase();
  const queries = parseQueryFields(res, req, ['limit', 'startAfterMillis'], ['50', `${Date.now()}`]);
  if ('error' in queries) {
    res.sendStatus(StatusCode.BadRequest);
    return;
  }
  if (!user) {
    error('Empty user');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }

  try {
    const data = await getUserOffersRef(user)
      .orderBy('metadata.createdAt', OrderDirection.Descending)
      .startAfter(queries.startAfterMillis)
      .limit(queries.limit)
      .get();
    const resp = getOrdersResponse(data);
    res.send(resp);
  } catch (err) {
    error('Failed to get offers made by user ' + user);
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};
