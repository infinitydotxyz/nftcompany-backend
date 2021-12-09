import { firestore } from '@base/container';
import { StatusCode } from '@base/types/StatusCode';
import { fstrCnstnts } from '@constants';
import { error } from '@utils/logger';
import { Router } from 'express';
const router = Router();

router.get('/', async (req, res) => {
  // @ts-ignore
  const user = (req.query.user || '').trim().toLowerCase();
  // @ts-ignore
  const email = (req.query.email || '').trim().toLowerCase();
  // @ts-ignore
  const guid = (req.query.guid || '').trim().toLowerCase();

  if (!user || !email || !guid) {
    error('Invalid input');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }

  const userDocRef = firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user);
  const userDoc = await userDocRef.get();
  // check email
  const storedEmail = userDoc.data().profileInfo.email.address;
  if (storedEmail !== email) {
    res.status(StatusCode.Unauthorized).send('Wrong email');
    return;
  }
  // check guid
  const storedGuid = userDoc.data().profileInfo.email.verificationGuid;
  if (storedGuid !== guid) {
    res.status(StatusCode.Unauthorized).send('Wrong verification code');
    return;
  }
  // all good
  userDocRef
    .set(
      {
        profileInfo: {
          email: {
            verified: true,
            subscribed: true
          }
        }
      },
      { merge: true }
    )
    .then((data) => {
      res.sendStatus(StatusCode.Ok);
    })
    .catch((err) => {
      error('Verifying email failed');
      error(err);
      res.sendStatus(StatusCode.InternalServerError);
    });
});

export default router;
