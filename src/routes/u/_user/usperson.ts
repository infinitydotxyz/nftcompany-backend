import { UsPersonAnswer, StatusCode } from '@infinityxyz/lib/types/core';
import { getUserInfoRef } from 'services/infinity/users/getUser';
import { error, trimLowerCase } from '@infinityxyz/lib/utils';
import { Request, Response } from 'express';

export const postUsPerson = async (req: Request<{ user: string }>, res: Response) => {
  const user = trimLowerCase(req.params.user);
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

  try {
    await getUserInfoRef(user).set(
      {
        profileInfo: {
          usResidentStatus: {
            usPerson: usPersonValue,
            answeredAt: Date.now()
          }
        }
      },
      { merge: true }
    );

    res.send({ usPerson: usPersonValue });
  } catch (err: any) {
    error('Setting US person status failed');
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};
