require('dotenv').config();
const { readFile } = require('fs').promises;
const { promisify } = require('util');
const parse = promisify(require('csv-parse'));

const firebaseAdmin = require('firebase-admin');

const serviceAccount = require('./creds/nftc-dev-firebase-creds.json');
firebaseAdmin.initializeApp({
  // @ts-ignore
  credential: firebaseAdmin.credential.cert(serviceAccount)
});

if (process.argv.length < 3) {
  console.error('Please include a path to a csv file');
  process.exit(1);
}

const db = firebaseAdmin.firestore();

const constants = require('./constants');
const fstrCnstnts = constants.firestore;

// eslint-disable-next-line no-unused-vars
async function importCsv(csvFileName) {
  const fileContents = await readFile(csvFileName, 'utf8');
  // @ts-ignore
  const records = await parse(fileContents, { columns: false });
  try {
    // await updateBlueCheck(records);
    await writeToFirestore(records);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
  console.log(`Processed ${records.length} records`);
}

// eslint-disable-next-line no-unused-vars
function writeToFirestore(records) {
  const batchCommits = [];
  let batch = db.batch();
  records.forEach((record, i) => {
    const [name, openseaUrl, address, description, cardImage, bannerImage] = record;
    const obj = { name, openseaUrl, address: address.trim().toLowerCase(), description, cardImage, bannerImage };
    console.log(obj);
    if (name && openseaUrl && address && description && cardImage && bannerImage) {
      const docRef = db.collection('featuredCollections').doc(address.trim().toLowerCase());
      batch.set(docRef, obj, { merge: true });
      if ((i + 1) % 500 === 0) {
        console.log(`Writing record ${i + 1}`);
        batchCommits.push(batch.commit());
        batch = db.batch();
      }
    }
  });
  batchCommits.push(batch.commit());
  return Promise.all(batchCommits);
}

// eslint-disable-next-line no-unused-vars
async function updateBlueCheck(records) {
  records.forEach((record, i) => {
    const address = record[1].trim().toLowerCase();
    console.log(address);
    const queryRef = db.collectionGroup(fstrCnstnts.LISTINGS_COLL).where('metadata.asset.address', '==', address);

    db.runTransaction(async (txn) => {
      const results = await txn.get(queryRef);
      console.log('length', results.docs.length);
      for (const doc of results.docs) {
        const docRef = doc.ref;
        txn.update(docRef, { 'metadata.hasBlueCheck': true });
      }
    });
  });
}

importCsv(process.argv[2]).catch((e) => console.error(e));
