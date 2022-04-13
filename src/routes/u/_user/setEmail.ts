import { StatusCode } from '@infinityxyz/lib/types/core';
import { API_BASE } from '../../..//constants';
import { sendEmail } from 'services/infinity/email/sendEmail';
import { getUserInfoRef } from 'services/infinity/users/getUser';
import { error, trimLowerCase } from '@infinityxyz/lib/utils';
import crypto from 'crypto';
import { Request, Response } from 'express';

export const postSetUserEmail = async (req: Request<{ user: string }>, res: Response) => {
  const user = trimLowerCase(req.params.user);
  const email = (req.body.email || '').trim().toLowerCase();
  if (!user || !email) {
    error('Invalid input');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }

  // Generate guid
  const guid = crypto.randomBytes(30).toString('hex');

  // Store
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

    // Send email
    const subject = 'Verify your email for Infinity';
    const link = `${API_BASE}/verifyEmail?email=${email}&user=${user}&guid=${guid}`;
    const html =
      '<p>Click the below link to verify your email</p> ' + '<a href=' + link + ' target="_blank">' + link + '</a>';
    sendEmail(email, subject, html);
    res.sendStatus(StatusCode.Ok);
  } catch (err: any) {
    error('Error setting user email for user', user);
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};
