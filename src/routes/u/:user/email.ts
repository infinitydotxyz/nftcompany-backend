import { firestore } from '@base/container';
import { lowRateLimit } from '@base/middleware/rateLimit';
import { StatusCode } from '@base/types/StatusCode';
import { API_BASE, fstrCnstnts } from '@constants';
import { jsonString } from '@utils/formatters';
import { error } from '@utils/logger';
import { Router } from 'express';
import { sendEmail } from './reward';
import crypto from 'crypto';

const router = Router();

// TODO rename to /u/:user/email
router.get('/u/:user/getEmail', async (req, res) => {
  const user = (`${req.params.user}` || '').trim().toLowerCase();

  if (!user) {
    error('Invalid input');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }

  const userDoc = await firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .get();

  const data = userDoc.data();

  if (data.profileInfo && data.profileInfo.email && data.profileInfo.email.address) {
    const resp = jsonString(data.profileInfo.email);
    // to enable cdn cache
    res.set({
      'Cache-Control': 'must-revalidate, max-age=30',
      'Content-Length': Buffer.byteLength(resp, 'utf8')
    });
    res.send(resp);
  } else {
    res.send('{}');
  }
});

router.post('/u/:user/setEmail', lowRateLimit, async (req, res) => {
  const user = (`${req.params.user}` || '').trim().toLowerCase();
  const email = (req.body.email || '').trim().toLowerCase();

  if (!user || !email) {
    error('Invalid input');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }

  // generate guid
  const guid = crypto.randomBytes(30).toString('hex');

  // store
  firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .set(
      {
        profileInfo: {
          email: {
            address: email,
            verificationGuid: guid,
            verified: false,
            subscribed: false
          }
        }
      },
      { merge: true }
    )
    .then(() => {
      // send email
      const subject = 'Verify your email for Infinity';
      const link = API_BASE + '/verifyEmail?email=' + email + '&user=' + user + '&guid=' + guid;
      const html =
        '<p>Click the below link to verify your email</p> ' + '<a href=' + link + ' target="_blank">' + link + '</a>';
      sendEmail(email, subject, html);
      res.sendStatus(StatusCode.Ok);
    })
    .catch((err) => {
      error('Error setting user email for user', user);
      error(err);
      res.sendStatus(StatusCode.InternalServerError);
    });
});

export default router;
