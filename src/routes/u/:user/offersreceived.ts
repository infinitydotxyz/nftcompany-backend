import { firestore } from '@base/container';
import { OrderDirection } from '@base/types/Queries';
import { StatusCode } from '@base/types/StatusCode';
import { fstrCnstnts } from '@constants';
import { getOrdersResponse } from '@services/infinity/utils';
import { error } from '@utils/logger';
import { parseQueryFields } from '@utils/parsers';
import { Router, Request, Response } from 'express';

const router = Router();

// fetch offer received by user
export const getUserOffersReceived = async (req: Request<{ user: string }>, res: Response) => {
  const user = (`${req.params.user}` || '').trim().toLowerCase();
  const sortByPrice = req.query.sortByPrice ?? OrderDirection.Descending; // descending default
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
    const data = await firestore.db
      .collectionGroup(fstrCnstnts.OFFERS_COLL)
      .where('metadata.asset.owner', '==', user)
      .orderBy('metadata.basePriceInEth', sortByPrice as OrderDirection)
      .orderBy('metadata.createdAt', OrderDirection.Descending)
      .startAfter(queries.startAfterMillis)
      .limit(queries.limit)
      .get();
    const resp = getOrdersResponse(data);
    res.send(resp);
  } catch (err) {
    error('Failed to get offers received by user ' + user);
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};

export default router;
