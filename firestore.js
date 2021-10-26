require('dotenv').config();
const { readFile } = require('fs').promises;
const { writeFileSync, appendFileSync } = require('fs');
const { promisify } = require('util');
const parse = promisify(require('csv-parse'));

const firebaseAdmin = require('firebase-admin');

const serviceAccount = require('./creds/nftc-dev-firebase-creds.json');
firebaseAdmin.initializeApp({
  // @ts-ignore
  credential: firebaseAdmin.credential.cert(serviceAccount)
});

const types = require('./types');

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
    // await writeToFirestore(records);
    // await updateVerifiedCollections(records);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
  console.log(`Processed ${records.length} records`);
}

// eslint-disable-next-line no-unused-vars
function updateVerifiedCollections(records) {
  const batchCommits = [];
  let batch = db.batch();
  records.forEach((record, i) => {
    const [name, address] = record;
    const obj = { name, address: address.trim().toLowerCase() };
    if (name && address) {
      const docRef = db.collection('root').doc('info').collection('verifiedTokens').doc(address.trim().toLowerCase());
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
function writeToFirestore(records) {
  const batchCommits = [];
  let batch = db.batch();
  records.forEach((record, i) => {
    const [name, openseaUrl, address, description, cardImage, bannerImage] = record;
    const obj = { name, openseaUrl, address: address.trim().toLowerCase(), description, cardImage, bannerImage };
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
    console.log('============================================================================');
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

let totalUsers = 0;
let thresholdUsers = 0;
let nonThresholdUsers = 0;
let thresholdDiff = 0;
// eslint-disable-next-line no-unused-vars
async function calcUserStats(csvFileName) {
  try {
    const limit = 1000;

    if (readComplete) {
      console.log('totalUsers', totalUsers);
      console.log('thresholdUsers', thresholdUsers);
      console.log('nonThresholdUsers', nonThresholdUsers);
      console.log('thresholdDiff', thresholdDiff);
      return;
    }
    console.log('============================================================================');
    console.log('num recurses', ++numRecurses);

    const fileContents = await readFile(csvFileName, 'utf8');
    // @ts-ignore
    const records = await parse(fileContents, { columns: false });
    let startAfterCreatedAt = records[0][1];
    if (!startAfterCreatedAt) {
      startAfterCreatedAt = Date.now();
    }
    await calcUserStatsHelper(+startAfterCreatedAt, limit);
    await calcUserStats(csvFileName);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

// eslint-disable-next-line no-unused-vars
async function calcUserStatsHelper(startAfterCreatedAt, limit) {
  console.log('starting after', startAfterCreatedAt);
  const snapshot = await db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .orderBy('rewardCalculatedAt', 'desc')
    .startAfter(startAfterCreatedAt)
    .limit(limit)
    .get();

  if (snapshot.docs.length < limit) {
    readComplete = true;
  }

  totalUsers += snapshot.docs.length;
  console.log('totalUsers so far', totalUsers);

  for (let i = 0; i < snapshot.docs.length; i++) {
    const doc = snapshot.docs[i];
    const payload = doc.data();
    const openseaVol = payload.openseaVol;
    const rewardTier = getUserRewardTier(openseaVol);
    const threshold = rewardTier.threshold;

    const userStats = { ...getEmptyUserInfo(), ...payload };
    const profileInfo = { ...getEmptyUserInfo().profileInfo, ...payload.profileInfo };

    const email = profileInfo.email.address;
    const verified = profileInfo.email.verified;
    const subscribed = profileInfo.email.subscribed;

    const salesTotalNumeric = userStats.salesTotalNumeric;
    const purchasesTotalNumeric = userStats.purchasesTotalNumeric;
    const doneSoFar = +salesTotalNumeric + +purchasesTotalNumeric;

    let diff = threshold - doneSoFar;
    if (diff <= 0) {
      thresholdUsers++;
      diff = 0;
      appendFileSync(
        './thresholdUsers',
        `${doc.id},${threshold},${doneSoFar},${diff},${email},${verified},${subscribed}\n`
      );
    } else {
      nonThresholdUsers++;
      thresholdDiff += diff;
      appendFileSync(
        './nonThresholdUsers',
        `${doc.id},${threshold},${doneSoFar},${diff},${email},${verified},${subscribed}\n`
      );
    }

    if ((i + 1) % limit === 0) {
      writeFileSync('./lastItem', `${doc.id},${payload.rewardCalculatedAt}\n`);
    }
  }
  console.log('thresholdUsers so far', thresholdUsers);
  console.log('nonThresholdUsers so far', nonThresholdUsers);
  console.log('thresholdDiff so far', thresholdDiff);
}

// ===================================================== MAINS ==========================================================

// main(process.argv[2]).catch((e) => console.error(e));

importCsv(process.argv[2]).catch((e) => console.error(e));

// calcUserStats(process.argv[2]).catch((e) => console.error(e));

// =================================================== HELPERS ===========================================================

function getUserRewardTier(userVol) {
  const rewardTiers = types.RewardTiers;

  if (userVol >= rewardTiers.t1.min && userVol < rewardTiers.t1.max) {
    return rewardTiers.t1;
  } else if (userVol >= rewardTiers.t2.min && userVol < rewardTiers.t2.max) {
    return rewardTiers.t2;
  } else if (userVol >= rewardTiers.t3.min && userVol < rewardTiers.t3.max) {
    return rewardTiers.t3;
  } else if (userVol >= rewardTiers.t4.min && userVol < rewardTiers.t4.max) {
    return rewardTiers.t4;
  } else if (userVol >= rewardTiers.t5.min && userVol < rewardTiers.t5.max) {
    return rewardTiers.t5;
  } else {
    return null;
  }
}

function getEmptyUserInfo() {
  return {
    numListings: '0',
    numBonusListings: '0',
    numOffers: '0',
    numBonusOffers: '0',
    numPurchases: '0',
    numSales: '0',
    salesTotal: '0',
    salesFeesTotal: '0',
    purchasesTotal: '0',
    purchasesFeesTotal: '0',
    salesTotalNumeric: 0,
    salesFeesTotalNumeric: 0,
    purchasesTotalNumeric: 0,
    purchasesFeesTotalNumeric: 0,
    salesAndPurchasesTotalNumeric: 0,
    rewardsInfo: getEmptyUserRewardInfo(),
    profileInfo: {
      email: {
        address: '',
        verified: false,
        subscribed: false
      }
    }
  };
}

function getEmptyUserRewardInfo() {
  return {
    share: '0',
    bonusShare: '0',
    salesShare: '0',
    purchasesShare: '0',
    rewardDebt: '0',
    bonusRewardDebt: '0',
    saleRewardDebt: '0',
    purchaseRewardDebt: '0',
    pending: '0',
    bonusPending: '0',
    salePending: '0',
    purchasePending: '0',
    grossReward: '0',
    netReward: '0',
    grossRewardNumeric: 0,
    netRewardNumeric: 0,
    openseaVol: 0,
    rewardCalculatedAt: Date.now()
  };
}
