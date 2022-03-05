// import { firestore } from '@base/container';
import { getUserInfoRef } from '@services/infinity/users/getUser';
import { error } from '@utils/logger';
import { Request, Response } from 'express';
import { StatusCode } from 'infinity-types/types/StatusCode';
import { jsonString } from '@utils/formatters';
import { fstrCnstnts } from '@base/constants';

export const getCollectionFollows = async (req: Request<{ user: string }>, res: Response) => {
  const user = (`${req.params.user}` || '').trim().toLowerCase();

  if (!user) {
    error('Invalid input');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }

  const follows = getUserInfoRef(user).collection(fstrCnstnts.COLLECTION_FOLLOWS_COLL);

  const followDocs = await follows.limit(50).get();

  const result: FirebaseFirestore.DocumentData[] = [];
  for (const doc of followDocs.docs) {
    result.push(doc.data());
  }

  const resp = jsonString(result);
  // to enable cdn cache
  res.set({
    'Cache-Control': 'must-revalidate, max-age=30',
    'Content-Length': Buffer.byteLength(resp ?? '', 'utf8')
  });
  res.send(resp);
};

export const setCollectionFollows = async (req: Request<{ user: string }>, res: Response) => {
  const user = (`${req.params.user}` || '').trim().toLowerCase();
  const collectionFollow = req.body.collectionFollow || [];
  const chainId = req.body.chainId;
  const deleteFollow = req.body.deleteFollow;

  if (!user || !collectionFollow || deleteFollow === undefined || !chainId) {
    error('Invalid input');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }

  try {
    const follows = getUserInfoRef(user).collection(fstrCnstnts.COLLECTION_FOLLOWS_COLL);

    const key = `${chainId}:${collectionFollow.address}`;
    if (deleteFollow) {
      await follows.doc(key).delete();
    } else {
      await follows.doc(key).set(collectionFollow);
    }

    res.sendStatus(StatusCode.Ok);
  } catch (err) {
    error('Error setting watchlist for user', user);
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};
