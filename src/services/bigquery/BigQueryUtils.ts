import path from 'path'
import { BigQuery } from '@google-cloud/bigquery';
import { fetchUserFollows } from 'routes/u/_user/collectionFollows';
import { trimLowerCase } from '@infinityxyz/lib/utils';

const options = {
  keyFilename: path.join(__dirname, '../../../creds/nftc-dev-bigquery-creds.json'),
  projectId: 'nftc-dev'
};
const bigquery = new BigQuery(options);

export async function init() {
  const user = trimLowerCase('0x006fA88c8b4C9D60393498Fd1b2ACf6abE254d72');
  const follows = await fetchUserFollows(user, 9999);
  const followAddresses = follows.map((item) => `'${item.address}'`).join(','); // 'addr1', 'addr2'

  const query = `SELECT
      JSON_EXTRACT_SCALAR(DATA,
        "$.collectionAddress") AS collectionAddr,
      CAST(JSON_EXTRACT_SCALAR(DATA,
          "$.price") AS FLOAT64) AS price,
      DATA
    FROM
      \`nftc-dev.fs_mirror_sales.sales_raw_latest\`
    WHERE
        JSON_EXTRACT_SCALAR(DATA, "$.collectionAddress") IN (${followAddresses})
    ORDER BY CAST(JSON_EXTRACT_SCALAR(DATA, "$.blockTimestamp") AS INT64)
    LIMIT 1000
  `;
  // console.log('query', query)
  const rows = await queryBigData(query);
  // console.log('rows', rows)
}

export async function queryBigData(query: string, datasetId = 'fs_mirror_sales', tableId = 'q_sales_by_collections') {
  const options = {
    query
  };
  const [job] = await bigquery.createQueryJob(options);
  let [rows] = await job.getQueryResults();
  // console.log('rows', rows)
  return rows;
}

export function queryDataExample(datasetId = 'fs_mirror_sales', tableId = 'q_sales_by_collections') {

  async function getTable() {
    // Retrieve table reference
    const dataset = bigquery.dataset(datasetId);
    const [table] = await dataset.table(tableId).get();
    // console.log('Table:');
    // console.log(table.metadata.tableReference);
  }
  getTable();
}
