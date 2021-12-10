import { firestore } from '@base/container';
import { StatusCode } from '@base/types/StatusCode';
import { API_BASE, fstrCnstnts } from '@constants';
import { error } from '@utils/logger';
import crypto from 'crypto';
import { Request, Response } from 'express';
import { sendEmail } from './reward';

export const postSetUserEmail = async (req: Request<{ user: string }>, res: Response) => {
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
};
