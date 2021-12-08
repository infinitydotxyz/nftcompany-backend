import { firestore } from '@base/container';
import { lowRateLimit } from '@base/middleware/rateLimit';
import { UsPersonAnswer } from '@base/types/RewardTiers';
import { StatusCode } from '@base/types/StatusCode';
import { fstrCnstnts } from '@constants';
import { error } from '@utils/logger';
import { Router } from 'express';
const router = Router();

router.post('/u/:user/usperson', lowRateLimit, async (req, res) => {
  const user = (`${req.params.user}` || '').trim().toLowerCase();
  const { usPerson }: { usPerson?: string } = req.body;

  let usPersonValue: string | number = '';
  if (usPerson) {
    usPersonValue = UsPersonAnswer[usPerson as 'yes' | 'no' | 'none' | 'answeredAt'];
  }

  if (!user || !usPersonValue) {
    error('Invalid input');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }

  firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .set(
      {
        profileInfo: {
          usResidentStatus: {
            usPerson: usPersonValue,
            answeredAt: Date.now()
          }
        }
      },
      { merge: true }
    )
    .then(() => {
      res.send({ usPerson: usPersonValue });
    })
    .catch((err) => {
      error('Setting US person status failed');
      error(err);
      res.sendStatus(StatusCode.InternalServerError);
    });
});

export default router;
