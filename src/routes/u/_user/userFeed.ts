import { trimLowerCase, jsonString } from '@infinityxyz/lib/utils';
import { Request, Response } from 'express';
import { queryBigData } from 'services/bigquery/BigQueryUtils';
// import { fetchUserFollows } from './collectionFollows';
import { validateInputs } from 'utils';

// const QUERY_BY_COLLECTIONS_LIMIT = 999;

export const getUserFeed = async (
  req: Request<
    { user: string },
    unknown,
    unknown,
    {
      limit: string;
    }
  >,
  res: Response
) => {
  const user = trimLowerCase(req.params.user);
  const limit = +req.query.limit ?? 50;
  const errorCode = validateInputs({ user }, ['user']);
  if (errorCode) {
    res.sendStatus(errorCode);
    return;
  }
  // const follows = await fetchUserFollows(user, QUERY_BY_COLLECTIONS_LIMIT);
  // const followAddresses = follows.map((item) => `'${item.address}'`).join(','); // 'addr1', 'addr2'

  const query = `
  SELECT
  *
FROM
  \`nftc-dev.fs_mirror_feed.feed_schema_fs_bq_ext_feed_latest\` AS A
INNER JOIN
  \`nftc-dev.fs_mirror_users_collectionFollows.users_collectionFollows_schema_fs_bq_ext_users_collectionfollows_schema_latest\` AS B
ON
  A.collectionAddress = B.address
LIMIT ${limit}
  `;
  // console.log('query', query)
  const rows = await queryBigData(query);
  // console.log('rows', rows)

  const resp = jsonString(rows);
  // to enable cdn cache
  res.set({
    'Cache-Control': 'must-revalidate, max-age=30',
    'Content-Length': Buffer.byteLength(resp ?? '', 'utf8')
  });
  res.send(resp);
};
