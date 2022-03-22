import { trimLowerCase, jsonString, firestoreConstants } from '@infinityxyz/lib/utils';
import { Request, Response } from 'express';
import { validateInputs } from 'utils';
import { BaseFeedEvent } from '@infinityxyz/lib/types/core/feed';
import { fetchUserFollows } from './collectionFollows';
import { firestore } from 'container';

const QUERY_ARRAY_IN_LIMIT = 10; // limit of Firestore where-in-array items.
const QUERY_BY_COLLECTIONS_LIMIT = 999;

const flattenArray = (array) => array.reduce((x, y) => x.concat(y.docs), []);

export const getUserFeed = async (
  req: Request<
    { user: string },
    unknown,
    unknown,
    {
      offset: string;
      limit: string;
    }
  >,
  res: Response
) => {
  const user = trimLowerCase(req.params.user);
  const offset = +req.query.offset ?? 0;
  const limit = +req.query.limit ?? 50;
  const errorCode = validateInputs({ user }, ['user']);
  if (errorCode) {
    res.sendStatus(errorCode);
    return;
  }

  const follows = await fetchUserFollows(user, QUERY_BY_COLLECTIONS_LIMIT);
  const followAddresses = follows.map((item) => item.address);
  const eventsRef = firestore.db.collection(firestoreConstants.FEED_COLL);

  // since firestore has a limit of 10 array items for the query 'in'
  // => split the followAddresses into chunks of 10 addresses, then query them in parallel.
  const promises: Array<Promise<FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>>> = [];
  for (let i = 0; i < followAddresses.length; i += QUERY_ARRAY_IN_LIMIT) {
    const addressesChunk = followAddresses.slice(i, i + QUERY_ARRAY_IN_LIMIT);
    promises.push(eventsRef.where('collectionAddress', 'in', addressesChunk).offset(offset).limit(limit).get());
  }
  const combinedResults = await Promise.all(promises);
  const pageResults = flattenArray(combinedResults);

  const data: FirebaseFirestore.DocumentData[] = [];
  for (const doc of pageResults) {
    data.push(doc.data() as BaseFeedEvent);
  }
  const resp = jsonString({
    data
  });

  // to enable cdn cache
  res.set({
    'Cache-Control': 'must-revalidate, max-age=30',
    'Content-Length': Buffer.byteLength(resp ?? '', 'utf8')
  });
  res.send(resp);
};
