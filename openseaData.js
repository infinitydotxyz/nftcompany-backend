const { readFile } = require('fs').promises;
const { promisify } = require('util');
const parse = promisify(require('csv-parse'));
const firebaseAdmin = require('firebase-admin');

const serviceAccount = require('./creds/nftc-infinity-firebase-creds.json');
firebaseAdmin.initializeApp({
  // @ts-ignore
  credential: firebaseAdmin.credential.cert(serviceAccount)
});

if (process.argv.length < 3) {
  console.error('Please include a path to a csv file');
  process.exit(1);
}

const db = firebaseAdmin.firestore();

async function importCsv(csvFileName) {
  const fileContents = await readFile(csvFileName, 'utf8');
  // @ts-ignore
  const records = await parse(fileContents, { columns: true });
  try {
    await writeToFirestore(records);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
  console.log(`Wrote ${records.length} records`);
}

function writeToFirestore(records) {
  const batchCommits = [];
  let batch = db.batch();
  records.forEach((record, i) => {
    const docRef = db.collection('openseaData').doc(record.from_address);
    batch.set(docRef, record);
    if ((i + 1) % 500 === 0) {
      console.log(`Writing record ${i + 1}`);
      batchCommits.push(batch.commit());
      batch = db.batch();
    }
  });
  batchCommits.push(batch.commit());
  return Promise.all(batchCommits);
}

importCsv(process.argv[2]).catch((e) => console.error(e));
