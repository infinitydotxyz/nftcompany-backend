import { firestore } from 'container';
import { StatusCode } from '@infinityxyz/lib/types/core';
import { error, log, trimLowerCase, jsonString } from '@infinityxyz/lib/utils';
import { Request, Response } from 'express';

// fetch user reward
export const getUserReward = async (req: Request<{ user: string }>, res: Response) => {
  const user = trimLowerCase(req.params.user);
  if (!user) {
    error('Invalid input');
    res.sendStatus(StatusCode.InternalServerError);
    return;
  }
  log('Fetching user rewards for', user);
  try {
    const doc = await firestore.collection('airdropStats').doc(user).get();
    const resp = doc.data();
    let respStr = '';
    if (resp != null) {
      respStr = jsonString(resp);
    }
    // to enable cdn cache
    res.set({
      'Cache-Control': 'must-revalidate, max-age=60',
      'Content-Length': Buffer.byteLength(respStr ?? '', 'utf8')
    });
    res.send(respStr);
  } catch (err) {
    error('Error fetching user rewards for', user, err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};
