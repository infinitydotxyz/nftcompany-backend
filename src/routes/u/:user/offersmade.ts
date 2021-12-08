import { firestore } from '@base/container';
import { StatusCode } from '@base/types/StatusCode';
import { fstrCnstnts } from '@constants';
import { error } from '@utils/logger';
import { parseQueryFields } from '@utils/parsers';
import { Router } from 'express';
import { getOrdersResponse } from './listings';
const router = Router();

// fetch offer made by user
router.get('/:user/offersmade', async (req, res) => {
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
  firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .collection(fstrCnstnts.OFFERS_COLL)
    .orderBy('metadata.createdAt', 'desc')
    .startAfter(startAfterMillis)
    .limit(limit)
    .get()
    .then((data) => {
      const resp = getOrdersResponse(data);
      res.send(resp);
    })
    .catch((err) => {
      error('Failed to get offers made by user ' + user);
      error(err);
      res.sendStatus(StatusCode.InternalServerError);
    });
});

export default router;
