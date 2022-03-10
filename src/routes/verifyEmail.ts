import { StatusCode } from '@infinityxyz/lib/types/core';
import { getUserInfoRef } from 'services/infinity/users/getUser';
import { error } from '@infinityxyz/lib/utils';
import { Router } from 'express';
const router = Router();

router.get('/', async (req, res) => {
  // @ts-expect-error
  const user = (req.query.user ?? '').trim().toLowerCase();
  // @ts-expect-error
  const email = (req.query.email ?? '').trim().toLowerCase();
  // @ts-expect-error
  const guid = (req.query.guid ?? '').trim().toLowerCase();

  if (!user || !email || !guid) {
    error('Invalid input');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }

  const userDocRef = getUserInfoRef(user);
  const userDoc = await userDocRef.get();
  // check email
  const storedEmail = userDoc.data()?.profileInfo?.email?.address;
  if (storedEmail !== email) {
    res.status(StatusCode.Unauthorized).send('Wrong email');
    return;
  }
  // check guid
  const storedGuid = userDoc.data()?.profileInfo?.email?.verificationGuid;
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
