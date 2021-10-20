require('dotenv').config();
const { readFile } = require('fs').promises;
const { writeFileSync } = require('fs');
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

let readComplete = false;
let numRecurses = 0;
let totalListings = 0;

// eslint-disable-next-line no-unused-vars
async function populateCollectionListings(startAfterSearchCollectionName, startAfterPrice, startAfterCreatedAt, limit) {
  const batchCommits = [];
  let batch = db.batch();
  console.log('starting after', startAfterSearchCollectionName, startAfterPrice, startAfterCreatedAt);
  const snapshot = await db
    .collectionGroup(fstrCnstnts.LISTINGS_COLL)
    .orderBy('metadata.asset.searchCollectionName', 'asc')
    .orderBy('metadata.basePriceInEth', 'desc')
    .orderBy('metadata.createdAt', 'desc')
    .startAfter(startAfterSearchCollectionName, startAfterPrice, startAfterCreatedAt)
    .limit(limit)
    .get();

  if (snapshot.docs.length < limit) {
    readComplete = true;
  }

  totalListings += snapshot.docs.length;

  for (let i = 0; i < snapshot.docs.length; i++) {
    const doc = snapshot.docs[i];
    const payload = doc.data();

    // console.log(
    //   doc.id,
    //   payload.metadata.asset.searchCollectionName,
    //   payload.metadata.basePriceInEth,
    //   payload.metadata.createdAt
    // );
    // console.log(JSON.stringify(payload, null, 2));

    const tokenAddress = payload.metadata.asset.address;
    const numOrders = 1;
    try {
      const docRef = db.collection(fstrCnstnts.COLLECTION_LISTINGS_COLL).doc(tokenAddress);
      const obj = {
        numListings: firebaseAdmin.firestore.FieldValue.increment(numOrders),
        metadata: {
          hasBlueCheck: payload.metadata.hasBlueCheck,
          schema: payload.metadata.schema,
          asset: {
            address: tokenAddress,
            collectionName: payload.metadata.asset.collectionName,
            searchCollectionName: payload.metadata.asset.searchCollectionName,
            description: payload.metadata.asset.description,
            image: payload.metadata.asset.image,
            imagePreview: payload.metadata.asset.imagePreview
          }
        }
      };

      batch.set(docRef, obj, { merge: true });

      if ((i + 1) % 500 === 0) {
        console.log(`Writing record ${i + 1}`);
        batchCommits.push(batch.commit());
        batch = db.batch();
      }

      if ((i + 1) % limit === 0) {
        console.log(
          'last item',
          payload.metadata.asset.searchCollectionName,
          payload.metadata.basePriceInEth,
          payload.metadata.createdAt
        );
        writeFileSync(
          './lastItem',
          `${payload.metadata.asset.searchCollectionName},${payload.metadata.basePriceInEth},${payload.metadata.createdAt}\n`
        );
      }
    } catch (err) {
      console.error(err);
    }
  }

  batchCommits.push(batch.commit());
  await Promise.all(batchCommits);
}

// eslint-disable-next-line no-unused-vars
async function main(csvFileName) {
  try {
    const limit = 5000;

    if (readComplete) {
      console.log('totalListings', totalListings);
      return;
    }
    console.log('num recurses', ++numRecurses);
    
    const fileContents = await readFile(csvFileName, 'utf8');
    // @ts-ignore
    const records = await parse(fileContents, { columns: false });
    let [startAfterSearchCollectionName, startAfterPrice, startAfterCreatedAt] = records[0];
    if (!startAfterPrice) {
      startAfterPrice = 1000000;
    }
    if (!startAfterCreatedAt) {
      startAfterCreatedAt = Date.now();
    }
    await populateCollectionListings(startAfterSearchCollectionName, +startAfterPrice, +startAfterCreatedAt, limit);
    await main(csvFileName);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main(process.argv[2]).catch((e) => console.error(e));

// importCsv(process.argv[2]).catch((e) => console.error(e));
