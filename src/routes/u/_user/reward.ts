import { firestore } from '@base/container';
import { StatusCode } from '@base/types/StatusCode';
import { jsonString } from '@utils/formatters';
import { error, log } from '@utils/logger';
import { Request, Response } from 'express';

// fetch user reward
export const getUserReward = async (req: Request<{ user: string }>, res: Response) => {
  const user = (`${req.params.user}` || '').trim().toLowerCase();
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
    error('Erorr fetching user rewards for', user, err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};
