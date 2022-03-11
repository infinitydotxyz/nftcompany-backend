import path from 'path'
import { BigQuery } from '@google-cloud/bigquery';

const options = {
  keyFilename: path.join(__dirname, '../../../creds/nftc-dev-bigquery-creds.json'),
  projectId: 'nftc-dev'
};
const bigquery = new BigQuery(options);

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
