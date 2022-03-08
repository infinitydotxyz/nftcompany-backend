import { StatusCode } from '@infinityxyz/lib/types/core';
import { getUserInfoRef } from 'services/infinity/users/getUser';
import { error } from 'utils/logger';
import { Request, Response } from 'express';
import { trimLowerCase } from 'utils';

export const postSubscribeUserEmail = async (req: Request<{ user: string }>, res: Response) => {
  const user = trimLowerCase(req.params.user);
  const data = req.body;

  if (!user || Object.keys(data).length === 0) {
    error('Invalid input');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }

  const isSubscribed = data.subscribe;
  try {
    await getUserInfoRef(user).set(
      {
        profileInfo: {
          email: {
            subscribed: isSubscribed
          }
        }
      },
      { merge: true }
    );

    res.send({ subscribed: isSubscribed });
  } catch (err) {
    error('Subscribing email failed');
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};
