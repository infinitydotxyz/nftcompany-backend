import { firestore } from '@base/container';
import { fstrCnstnts } from '@constants';
import { error } from '@utils/logger';
import { parseQueryFields } from '@utils/parsers';
import { Router } from 'express';
import { getOrdersResponse } from './listings';
const router = Router();

// fetch offer received by user
router.get('/:user/offersreceived', async (req, res) => {
  const user = (`${req.params.user}` || '').trim().toLowerCase();
  const sortByPrice = req.query.sortByPrice || 'desc'; // descending default
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
    res.sendStatus(500);
    return;
  }
  firestore.db
    .collectionGroup(fstrCnstnts.OFFERS_COLL)
    .where('metadata.asset.owner', '==', user)
    // @ts-ignore
    .orderBy('metadata.basePriceInEth', sortByPrice)
    .orderBy('metadata.createdAt', 'desc')
    .startAfter(startAfterMillis)
    .limit(limit)
    .get()
    .then((data) => {
      const resp = getOrdersResponse(data);
      res.send(resp);
    })
    .catch((err) => {
      error('Failed to get offers received by user ' + user);
      error(err);
      res.sendStatus(500);
    });
});

export default router;
