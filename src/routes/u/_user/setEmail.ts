import { StatusCode } from '@infinityxyz/types/core';
import { API_BASE } from '../../..//constants';
import { sendEmail } from 'services/infinity/email/sendEmail';
import { getUserInfoRef } from 'services/infinity/users/getUser';
import { error } from 'utils/logger';
import crypto from 'crypto';
import { Request, Response } from 'express';
import { trimLowerCase } from 'utils';

export const postSetUserEmail = async (req: Request<{ user: string }>, res: Response) => {
  const user = trimLowerCase(req.params.user);
  const email = (req.body.email || '').trim().toLowerCase();
  if (!user || !email) {
    error('Invalid input');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }

  // generate guid
  const guid = crypto.randomBytes(30).toString('hex');

  // store
  try {
    await getUserInfoRef(user).set(
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
    );

    // send email
    const subject = 'Verify your email for Infinity';
    const link = `${API_BASE}/verifyEmail?email=${email}&user=${user}&guid=${guid}`;
    const html =
      '<p>Click the below link to verify your email</p> ' + '<a href=' + link + ' target="_blank">' + link + '</a>';
    sendEmail(email, subject, html);
    res.sendStatus(StatusCode.Ok);
  } catch (err) {
    error('Error setting user email for user', user);
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};
