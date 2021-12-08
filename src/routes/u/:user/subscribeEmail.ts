import { firestore } from '@base/container';
import { lowRateLimit } from '@base/middleware/rateLimit';
import { StatusCode } from '@base/types/StatusCode';
import { fstrCnstnts } from '@constants';
import { error } from '@utils/logger';
import { Router } from 'express';

const router = Router();

router.post('/u/:user/subscribeEmail', lowRateLimit, async (req, res) => {
  const user = (`${req.params.user}` || '').trim().toLowerCase();
  const data = req.body;

  if (!user || Object.keys(data).length === 0) {
    error('Invalid input');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }

  const isSubscribed = data.subscribe;
  firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .set(
      {
        profileInfo: {
          email: {
            subscribed: isSubscribed
          }
        }
      },
      { merge: true }
    )
    .then(() => {
      res.send({ subscribed: isSubscribed });
    })
    .catch((err) => {
      error('Subscribing email failed');
      error(err);
      res.sendStatus(StatusCode.InternalServerError);
    });
});

export default router;
