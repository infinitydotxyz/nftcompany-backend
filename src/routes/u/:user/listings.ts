import { firestore } from '@base/container';
import { StatusCode } from '@base/types/StatusCode';
import { fstrCnstnts } from '@constants';
import { getOrdersResponseFromArray } from '@routes/listings';
import { error } from '@utils/logger';
import { parseQueryFields } from '@utils/parsers';
import { Router, Request } from 'express';
const router = Router();

// fetch listings of user
router.get('/', async (req: Request<{ user: string }>, res) => {
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
  firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .collection(fstrCnstnts.LISTINGS_COLL)
    .orderBy('metadata.createdAt', 'desc')
    .startAfter(startAfterMillis)
    .limit(limit)
    .get()
    .then((data) => {
      const resp = getOrdersResponse(data);
      res.send(resp);
    })
    .catch((err) => {
      error('Failed to get user listings for user ' + user);
      error(err);
      res.sendStatus(500);
    });
});

export function getOrdersResponse(data: any) {
  return getOrdersResponseFromArray(data.docs);
}

export default router;
