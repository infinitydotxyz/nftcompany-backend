// import { firestore } from '@base/container';
import { getUserInfoRef } from '@services/infinity/users/getUser';
import { error } from '@utils/logger';
import { Request, Response } from 'express';
import { StatusCode } from '@base/types/StatusCode';
import { jsonString } from '@utils/formatters';

export const getUserWatchlist = async (req: Request<{ user: string }>, res: Response) => {
  const user = (`${req.params.user}` || '').trim().toLowerCase();

  if (!user) {
    error('Invalid input');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }

  const userDoc = await getUserInfoRef(user).get();

  const data = userDoc.data();
  if (data?.watchlist) {
    const resp = jsonString(data.watchlist);
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

export const setUserWatchlist = async (req: Request<{ user: string }>, res: Response) => {
  const user = (`${req.params.user}` || '').trim().toLowerCase();
  const watchlist = req.body.watchlist || [];
  if (!user || !watchlist) {
    error('Invalid input');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }

  // store
  try {
    await getUserInfoRef(user).set(
      {
        watchlist: watchlist
      },
      { merge: true }
    );

    res.sendStatus(StatusCode.Ok);
  } catch (err) {
    error('Error setting watchlist for user', user);
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};
