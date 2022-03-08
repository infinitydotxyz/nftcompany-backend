// import { firestore } from '@base/container';
import { getUserInfoRef } from 'services/infinity/users/getUser';
import { error } from 'utils/logger';
import { Request, Response } from 'express';
import { StatusCode } from '@infinityxyz/lib/types/core';
import { jsonString } from 'utils/formatters';
import { fstrCnstnts } from '../../../constants';
import { trimLowerCase } from 'utils/index';
import { UserFollow } from '@infinityxyz/lib/types/core/Follows';

export const getUserFollows = async (
  req: Request<
    { user: string },
    any,
    any,
    {
      limit: string;
    }
  >,
  res: Response
) => {
  const user = trimLowerCase(req.params.user);
  const limit = +req.query.limit ?? 50;

  if (!user) {
    error('Invalid input');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }

  const follows = getUserInfoRef(user).collection(fstrCnstnts.USER_FOLLOWS_COLL);

  const followDocs = await follows.limit(limit).get();

  const result: FirebaseFirestore.DocumentData[] = [];
  for (const doc of followDocs.docs) {
    result.push(doc.data() as UserFollow);
  }

  const resp = jsonString(result);
  // to enable cdn cache
  res.set({
    'Cache-Control': 'must-revalidate, max-age=30',
    'Content-Length': Buffer.byteLength(resp ?? '', 'utf8')
  });
  res.send(resp);
};

export const setUserFollow = async (req: Request<{ user: string }>, res: Response) => {
  const user = trimLowerCase(req.params.user);
  const userFollow = req.body.userFollow as UserFollow;
  const chainId = req.body.chainId;
  const deleteFollow = req.body.deleteFollow;

  if (!user || !userFollow || deleteFollow === undefined || !chainId) {
    error('Invalid input');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }

  try {
    const follows = getUserInfoRef(user).collection(fstrCnstnts.USER_FOLLOWS_COLL);

    const key = `${chainId}:${userFollow.address}`;
    if (deleteFollow) {
      await follows.doc(key).delete();
    } else {
      await follows.doc(key).set(userFollow);
    }

    res.sendStatus(StatusCode.Ok);
  } catch (err) {
    error('Error setting watchlist for user', user);
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};
