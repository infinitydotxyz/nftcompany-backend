import { getUserInfoRef } from 'services/infinity/users/getUser';
import { error, trimLowerCase, jsonString } from '@infinityxyz/lib/utils';
import { Request, Response } from 'express';
import { StatusCode } from '@infinityxyz/lib/types/core';
import { fstrCnstnts } from '../../../constants';
import { CollectionFollow } from '@infinityxyz/lib/types/core/Follows';

export const fetchUserFollows = async (userAddress: string, limit: number) => {
  // const docRef = getUserInfoRef(userAddress);
  // console.log('--- docRef.get', (await docRef.get()).data());

  const follows = getUserInfoRef(userAddress).collection(fstrCnstnts.COLLECTION_FOLLOWS_COLL);

  const followDocs = await follows.limit(limit).get();

  const result: FirebaseFirestore.DocumentData[] = [];
  for (const doc of followDocs.docs) {
    result.push(doc.data() as CollectionFollow);
  }
  // console.log('result', result)
  return result;
}

export const getCollectionFollows = async (
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
  const result = await fetchUserFollows(user, limit);  

  const resp = jsonString(result);
  // to enable cdn cache
  res.set({
    'Cache-Control': 'must-revalidate, max-age=30',
    'Content-Length': Buffer.byteLength(resp ?? '', 'utf8')
  });
  res.send(resp);
};

export const setCollectionFollow = async (req: Request<{ user: string }>, res: Response) => {
  const user = trimLowerCase(req.params.user);
  const collectionFollow = req.body.collectionFollow as CollectionFollow;
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
