import { StatusCode } from '@infinityxyz/types/core/StatusCode';
import { getUserInfoRef } from '@services/infinity/users/getUser';
import { error } from '@utils/logger';
import { Request, Response } from 'express';

export const postSubscribeUserEmail = async (req: Request<{ user: string }>, res: Response) => {
  const user = (`${req.params.user}` || '').trim().toLowerCase();
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
