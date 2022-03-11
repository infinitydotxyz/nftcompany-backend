import { trimLowerCase, jsonString } from '@infinityxyz/lib/utils';
import { Request, Response } from 'express';
import { queryBigData } from 'services/bigquery/BigQueryUtils';
import { fetchUserFollows } from './collectionFollows';
import { validateInputs } from 'utils';

export const getUserFeed = async (
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
  const errorCode = validateInputs({ user }, ['user']);
  if (errorCode) {
    res.sendStatus(errorCode);
    return;
  }
  const follows = await fetchUserFollows(user, 9999);
  const followAddresses = follows.map((item) => `'${item.address}'`).join(','); // 'addr1', 'addr2'

  const query = `SELECT
      JSON_EXTRACT_SCALAR(DATA, "$.chainId") AS chainId,
      JSON_EXTRACT_SCALAR(DATA, "$.collectionAddress") AS tokenAddress,
      JSON_EXTRACT_SCALAR(DATA, "$.tokenId") AS tokenId,
      JSON_EXTRACT_SCALAR(DATA, "$.buyer") AS buyer,
      JSON_EXTRACT_SCALAR(DATA, "$.seller") AS seller,
      JSON_EXTRACT_SCALAR(DATA, "$.price") AS price,
      JSON_EXTRACT_SCALAR(DATA, "$.blockTimestamp") AS timestamp
    FROM
      \`nftc-dev.fs_mirror_sales.sales_raw_latest\`
    WHERE
        JSON_EXTRACT_SCALAR(DATA, "$.collectionAddress") IN (${followAddresses})
    ORDER BY CAST(JSON_EXTRACT_SCALAR(DATA, "$.blockTimestamp") AS INT64)
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
