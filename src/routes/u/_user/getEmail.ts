import { StatusCode } from '@infinityxyz/types/core';
import { getUserInfoRef } from 'services/infinity/users/getUser';
import { jsonString } from 'utils/formatters';
import { error } from 'utils/logger';
import { Request, Response } from 'express';
import { trimLowerCase } from 'utils';

export const getUserEmail = async (req: Request<{ user: string }>, res: Response) => {
  const user = trimLowerCase(req.params.user);

  if (!user) {
    error('Invalid input');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }

  const userDoc = await getUserInfoRef(user).get();

  const data = userDoc.data();
  if (data?.profileInfo?.email?.address) {
    const resp = jsonString(data.profileInfo.email);
    // to enable cdn cache
    res.set({
      'Cache-Control': 'must-revalidate, max-age=30',
      'Content-Length': Buffer.byteLength(resp ?? '', 'utf8')
    });
    res.send(resp);
  } else {
    res.send('{}');
  }
};
