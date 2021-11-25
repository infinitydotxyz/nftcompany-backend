/* eslint-disable no-unused-vars */
require('dotenv').config();
const { ethers } = require('ethers');
const ethersProvider = new ethers.providers.JsonRpcProvider(process.env.alchemyJsonRpcEthMainnet); // polymain

const { readFile } = require('fs').promises;
const { writeFileSync, appendFileSync } = require('fs');
const { promisify } = require('util');
const parse = promisify(require('csv-parse'));
const axios = require('axios').default;

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

const erc721Abi = require('./abi/erc721.json');
const erc1155Abi = require('./abi/erc1155.json');

// eslint-disable-next-line no-unused-vars
async function importCsv(csvFileName) {
  const fileContents = await readFile(csvFileName, 'utf8');
  // @ts-ignore
  const records = await parse(fileContents, { columns: false });
  try {
    // await updateBlueCheck(records);
    // await updateFeaturedCollections(records);
    // await updateAllCollections(records);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
  console.log(`Processed ${records.length} records`);
}

// eslint-disable-next-line no-unused-vars
function updateAllCollections(records) {
  const batchCommits = [];
  let batch = db.batch();
  records.forEach((record, i) => {
    const [name, openseaUrl, address, description, profileImage, bannerImage, verified] = record;
    let verifiedBool = false;
    if (verified && verified.trim().toLowerCase() === 'true') {
      verifiedBool = true;
    }
    const obj = {
      name,
      openseaUrl,
      address: address.trim().toLowerCase(),
      description,
      profileImage,
      bannerImage,
      cardImage: bannerImage,
      hasBlueCheck: verifiedBool
    };
    if (name && openseaUrl && address && description && profileImage && bannerImage) {
      obj.searchCollectionName = name.replace(/[\s-_]/g, '').toLowerCase();
      const docRef = db.collection(fstrCnstnts.ALL_COLLECTIONS_COLL).doc(address.trim().toLowerCase());
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
function updateFeaturedCollections(records) {
  const batchCommits = [];
  let batch = db.batch();
  records.forEach((record, i) => {
    const [name, openseaUrl, address, description, profileImage, bannerImage] = record;
    const obj = { name, openseaUrl, address: address.trim().toLowerCase(), description, profileImage, bannerImage };
    if (name && openseaUrl && address && description && profileImage && bannerImage) {
      const docRef = db.collection(fstrCnstnts.FEATURED_COLL).doc(address.trim().toLowerCase());
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
    const address = record[2].trim().toLowerCase();
    console.log(address);
    const queryRef = db.collectionGroup(fstrCnstnts.LISTINGS_COLL).where('metadata.asset.address', '==', address);

    db.runTransaction(async (txn) => {
      const results = await txn.get(queryRef);
      const doc = results.docs[0];
      if (doc) {
        console.log(doc.data().metadata.asset.address + ' ' + results.docs.length);
      }
      if (results.docs.length < 500) {
        for (const doc of results.docs) {
          const docRef = doc.ref;
          txn.update(docRef, { 'metadata.hasBlueCheck': true });
        }
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

      if ((i + 1) % limit === 0) {
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

let prunedListings = 0;
async function pruneStaleListings(csvFileName) {
  try {
    const limit = 100;

    if (readComplete) {
      console.log('totalListings', totalListings);
      console.log('prunedListings', prunedListings);
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
    await pruneStaleListingsHelper(+startAfterCreatedAt, limit);
    await pruneStaleListings(csvFileName);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

async function pruneStaleListingsHelper(startAfterCreatedAt, limit) {
  console.log('starting after', startAfterCreatedAt);

  const query = db
    .collectionGroup(fstrCnstnts.LISTINGS_COLL)
    .orderBy('metadata.createdAt', 'desc')
    .startAfter(startAfterCreatedAt)
    .limit(limit);
  const snapshot = await query.get();
  const nullAddress = '0x0000000000000000000000000000000000000000';

  if (snapshot.docs.length < limit) {
    readComplete = true;
  }

  totalListings += snapshot.docs.length;
  console.log('totalListings so far', totalListings);
  console.log('prunedListings so far', prunedListings);

  for (let i = 0; i < snapshot.docs.length; i++) {
    const doc = snapshot.docs[i];
    const ref = doc.ref;
    const data = doc.data();
    const maker = data.maker;
    const address = data.metadata.asset.address;
    const id = data.metadata.asset.id;
    const schema = data.metadata.schema;

    if ((i + 1) % limit === 0) {
      writeFileSync('./lastItem', `${doc.id},${data.metadata.createdAt}\n`);
    }

    try {
      if (schema && schema.trim().toLowerCase() === 'erc721') {
        const contract = new ethers.Contract(address, erc721Abi, ethersProvider);
        let owner = await contract.ownerOf(id);
        owner = owner.trim().toLowerCase();
        if (owner !== nullAddress && owner !== maker) {
          console.log('stale', maker, owner, address, id);
          ref
            .delete()
            .then(() => {
              prunedListings++;
              console.log('pruned erc721', doc.id, maker, owner, address, id);
            })
            .catch((err) => {
              console.error('Error deleting', doc.id, maker, err);
            });
        }
      } else if (schema && schema.trim().toLowerCase() === 'erc1155') {
        const contract = new ethers.Contract(address, erc1155Abi, ethersProvider);
        const balance = await contract.balanceOf(maker, id);

        if (maker !== nullAddress && balance === 0) {
          console.log('stale', maker, maker, address, id);
          ref
            .delete()
            .then(() => {
              prunedListings++;
              console.log('pruned erc1155', doc.id, maker, maker, address, id, balance);
            })
            .catch((err) => {
              console.error('Error deleting', doc.id, maker, err);
            });
        }
      }
    } catch (err) {
      console.error(err);
      console.error('=================REASON=============');
      console.error(err.reason);
      if (err.reason.indexOf('nonexistent token') > 0) {
        doc.ref
          .delete()
          .then(() => {
            console.log('pruned erc721 after token id non existent', doc.id, address, id);
          })
          .catch((err) => {
            console.error('Error deleting nonexistent token id order', doc.id, err);
          });
      }
    }
  }
}

// async function pruneStaleNonERC721Listings(fileName) {
//   const fileContents = await readFile(fileName, 'utf8');
//   const json = JSON.parse(fileContents);
//   const apiBase = 'https://api.opensea.io/api/v1/assets/';
//   const authKey = process.env.openseaKey;
//   const limit = 1;
//   const offset = 0;
//   const url = apiBase;
//   const nullAddress = '0x0000000000000000000000000000000000000000';
//   const openseaSharedStore = '0x495f947276749ce646f68ac8c248420045cb7b5e';
//   let pruned = 0;

//   for (const [address, ids] of Object.entries(json)) {
//     if (address === openseaSharedStore || ids.length > 30) {
//       continue;
//     }

//     let tokenIds = '';
//     const idsMap = {};
//     for (const id of ids) {
//       const exisingId = idsMap[id];
//       if (!exisingId) {
//         idsMap[id] = id;
//         tokenIds += 'token_ids=' + id + '&';
//       }
//     }

//     tokenIds = tokenIds.substr(0, tokenIds.length - 1);
//     console.log(tokenIds);

//     const options = {
//       headers: {
//         'X-API-KEY': authKey
//       }
//     };

//     try {
//       // const resp = await axios.get(url, options);
//       const resp = await axios.get(
//         url + '?asset_contract_address=' + address + '&limit=' + limit + '&offset=' + offset + '&' + tokenIds
//       );
//       for (const asset of resp.data.assets) {
//         const owner = asset.owner.address.trim().toLowerCase();

//         const query = await db
//           .collectionGroup(fstrCnstnts.LISTINGS_COLL)
//           .where('metadata.asset.id', '==', asset.token_id)
//           .where('metadata.asset.address', '==', address)
//           .limit(limit)
//           .get();

//         const doc = query.docs[0];

//         if (owner !== nullAddress && owner !== doc.data().maker) {
//           console.log('stale', doc.id, doc.data().maker, owner);
//           doc.ref
//             .delete()
//             .then((res) => {
//               console.log(++pruned);
//             })
//             .catch((err) => {
//               console.error('Error deleting', doc.id, doc.data().maker, err);
//             });
//         }
//       }
//     } catch (err) {
//       console.log(err.message);
//     }
//   }
// }

async function updateTraits(csvFileName) {
  try {
    const limit = 500;

    if (readComplete) {
      console.log('totalListings', totalListings);
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
    await updateTraitsHelper(+startAfterCreatedAt, limit);
    await updateTraits(csvFileName);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

async function updateTraitsHelper(startAfterCreatedAt, limit) {
  console.log('starting after', startAfterCreatedAt);
  const batchCommits = [];
  let batch = db.batch();

  const query = db
    .collectionGroup(fstrCnstnts.LISTINGS_COLL)
    .orderBy('metadata.createdAt', 'desc')
    .startAfter(startAfterCreatedAt)
    .limit(limit);
  const snapshot = await query.get();

  if (snapshot.docs.length < limit) {
    readComplete = true;
  }

  totalListings += snapshot.docs.length;
  console.log('totalListings so far', totalListings);

  try {
    for (let i = 0; i < snapshot.docs.length; i++) {
      const doc = snapshot.docs[i];
      const ref = doc.ref;
      const data = doc.data();
      const rawTraits = data.metadata.asset.rawData.traits;

      if ((i + 1) % limit === 0) {
        writeFileSync('./lastItem', `${doc.id},${data.metadata.createdAt}\n`);
      }
      const numTraits = rawTraits.length;
      const traits = [];
      for (const rawTrait of rawTraits) {
        traits.push({ traitType: rawTrait.trait_type, traitValue: String(rawTrait.value) });
      }

      const obj = {
        metadata: {
          asset: {
            numTraits,
            traits
          }
        }
      };

      batch.set(ref, obj, { merge: true });

      if ((i + 1) % limit === 0) {
        console.log(`Writing record ${i + 1}`);
        batchCommits.push(batch.commit());
        batch = db.batch();
      }
    }
  } catch (err) {
    console.error(err);
  }
  batchCommits.push(batch.commit());
  await Promise.all(batchCommits);
}

async function updateListingType(csvFileName) {
  try {
    const limit = 500;

    if (readComplete) {
      console.log('totalListings', totalListings);
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
    await updateListingTypeHelper(+startAfterCreatedAt, limit);
    await updateListingType(csvFileName);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

async function updateListingTypeHelper(startAfterCreatedAt, limit) {
  console.log('starting after', startAfterCreatedAt);
  const batchCommits = [];
  let batch = db.batch();

  const query = db
    .collectionGroup(fstrCnstnts.LISTINGS_COLL)
    .orderBy('metadata.createdAt', 'desc')
    .startAfter(startAfterCreatedAt)
    .limit(limit);
  const snapshot = await query.get();

  if (snapshot.docs.length < limit) {
    readComplete = true;
  }

  totalListings += snapshot.docs.length;
  console.log('totalListings so far', totalListings);

  try {
    for (let i = 0; i < snapshot.docs.length; i++) {
      const doc = snapshot.docs[i];
      const ref = doc.ref;
      const data = doc.data();

      if ((i + 1) % limit === 0) {
        writeFileSync('./lastItem', `${doc.id},${data.metadata.createdAt}\n`);
      }

      let listingType = 'fixedPrice';
      if (data.englishAuctionReservePrice !== undefined) {
        listingType = 'englishAuction';
      } else if (data.saleKind === 1) {
        listingType = 'dutchAuction';
      }

      const obj = {
        metadata: {
          listingType
        }
      };

      batch.set(ref, obj, { merge: true });

      if ((i + 1) % limit === 0) {
        console.log(`Writing record ${i + 1}`);
        batchCommits.push(batch.commit());
        batch = db.batch();
      }
    }
  } catch (err) {
    console.error(err);
  }
  batchCommits.push(batch.commit());
  await Promise.all(batchCommits);
}

async function updateSearchTitleAndCollName(csvFileName) {
  try {
    const limit = 500;

    if (readComplete) {
      console.log('totalListings', totalListings);
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
    await updateSearchTitleAndCollNameHelper(+startAfterCreatedAt, limit);
    await updateSearchTitleAndCollName(csvFileName);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

async function updateSearchTitleAndCollNameHelper(startAfterCreatedAt, limit) {
  console.log('starting after', startAfterCreatedAt);
  const batchCommits = [];
  let batch = db.batch();

  const query = db
    .collectionGroup(fstrCnstnts.LISTINGS_COLL)
    .orderBy('metadata.createdAt', 'desc')
    .startAfter(startAfterCreatedAt)
    .limit(limit);
  const snapshot = await query.get();

  if (snapshot.docs.length < limit) {
    readComplete = true;
  }

  totalListings += snapshot.docs.length;
  console.log('totalListings so far', totalListings);

  try {
    for (let i = 0; i < snapshot.docs.length; i++) {
      const doc = snapshot.docs[i];
      const ref = doc.ref;
      const data = doc.data();

      if ((i + 1) % limit === 0) {
        writeFileSync('./lastItem', `${doc.id},${data.metadata.createdAt}\n`);
      }

      let searchTitle = data.metadata.asset.searchTitle;
      let searchCollectionName = data.metadata.asset.searchCollectionName;

      searchTitle = searchTitle && searchTitle.replace(/[\s-_]/g, '').toLowerCase();
      searchCollectionName = searchCollectionName && searchCollectionName.replace(/[\s-_]/g, '').toLowerCase();

      const obj = {
        metadata: {
          asset: {
            searchTitle,
            searchCollectionName
          }
        }
      };

      batch.set(ref, obj, { merge: true });

      if ((i + 1) % limit === 0) {
        console.log(`Writing record ${i + 1}`);
        batchCommits.push(batch.commit());
        batch = db.batch();
      }
    }
  } catch (err) {
    console.error(err);
  }
  batchCommits.push(batch.commit());
  await Promise.all(batchCommits);
}

async function updateChainIdInListings(csvFileName) {
  try {
    const limit = 500;

    if (readComplete) {
      console.log('totalListings', totalListings);
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
    await updateChainIdInListingsHelper(+startAfterCreatedAt, limit);
    await updateChainIdInListings(csvFileName);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

async function updateChainIdInListingsHelper(startAfterCreatedAt, limit) {
  console.log('starting after', startAfterCreatedAt);
  const batchCommits = [];
  let batch = db.batch();

  const query = db
    .collectionGroup(fstrCnstnts.LISTINGS_COLL)
    .orderBy('metadata.createdAt', 'desc')
    .startAfter(startAfterCreatedAt)
    .limit(limit);
  const snapshot = await query.get();

  if (snapshot.docs.length < limit) {
    readComplete = true;
  }

  totalListings += snapshot.docs.length;
  console.log('totalListings so far', totalListings);

  try {
    for (let i = 0; i < snapshot.docs.length; i++) {
      const doc = snapshot.docs[i];
      const ref = doc.ref;
      const data = doc.data();

      if ((i + 1) % limit === 0) {
        writeFileSync('./lastItem', `${doc.id},${data.metadata.createdAt}\n`);
      }

      const obj = {
        metadata: {
          chainId: '1',
          chain: 'Ethereum'
        }
      };

      batch.set(ref, obj, { merge: true });

      if ((i + 1) % limit === 0) {
        console.log(`Writing record ${i + 1}`);
        batchCommits.push(batch.commit());
        batch = db.batch();
      }
    }
  } catch (err) {
    console.error(err);
  }
  batchCommits.push(batch.commit());
  await Promise.all(batchCommits);
}

// ===================================================== MAINS ==========================================================

// main(process.argv[2]).catch((e) => console.error(e));

// importCsv(process.argv[2]).catch((e) => console.error(e));

// calcUserStats(process.argv[2]).catch((e) => console.error(e));

// pruneStaleListings(process.argv[2]).catch((e) => console.error(e));

// updateTraits(process.argv[2]).catch((e) => console.error(e));

// updateListingType(process.argv[2]).catch((e) => console.error(e));

// updateSearchTitleAndCollName(process.argv[2]).catch((e) => console.error(e));

updateChainIdInListings(process.argv[2]).catch((e) => console.error(e));

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
