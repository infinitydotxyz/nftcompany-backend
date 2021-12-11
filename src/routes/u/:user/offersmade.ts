import { StatusCode } from '@base/types/StatusCode';
import { getUserOffersRef } from '@services/infinity/users/offers/getUserOffersRef';
import { getOrdersResponse } from '@services/infinity/utils';
import { error } from '@utils/logger';
import { parseQueryFields } from '@utils/parsers';
import { Request, Response } from 'express';

// fetch offer made by user
export const getUserOffersMade = async (req: Request<{ user: string }>, res: Response) => {
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
      .orderBy('metadata.createdAt', 'desc')
      .startAfter(startAfterMillis)
      .limit(limit)
      .get();
    const resp = getOrdersResponse(data);
    res.send(resp);
  } catch (err) {
    error('Failed to get offers made by user ' + user);
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};
