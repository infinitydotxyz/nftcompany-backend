import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';
import { BIGQUERY_SERVICE_ACCOUNT } from '../../constants';

const options = {
  keyFilename: path.join(__dirname, `../../../creds/${BIGQUERY_SERVICE_ACCOUNT}`)
};
const bigquery = new BigQuery(options);

export async function queryBigData(query: string) {
  const options = {
    query
  };
  const [job] = await bigquery.createQueryJob(options);
  const [rows] = await job.getQueryResults();
  // console.log('rows', rows)
  return rows;
}

// export async function queryDataExample(datasetId = 'fs_mirror_sales', tableId = 'q_sales_by_collections') {
//   const dataset = bigquery.dataset(datasetId);
//   const [table] = await dataset.table(tableId).get();
//   // console.log('Table:');
//   // console.log(table.metadata.tableReference);
// }
