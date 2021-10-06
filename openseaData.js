require('dotenv').config();
const { readFile } = require('fs').promises;
const { appendFileSync } = require('fs');
const { promisify } = require('util');
const parse = promisify(require('csv-parse'));

const { ethers } = require('ethers');
const ethersProvider = new ethers.providers.JsonRpcProvider(process.env.alchemyJsonRpcEthMainnet);

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
  const records = await parse(fileContents, { columns: false });
  try {
    // await writeToFirestore(records);
    await removeInvalidAddresses(records);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
  console.log(`Processed ${records.length} records`);
}

async function removeInvalidAddresses(records) {
  for (let i = 0; i < records.length; i++) {
    console.log(i);
    if (i > 999) {
        break;
    }
    const record = records[i];
    const address = record[0];
    const total = record[1];
    const isValid = ethers.utils.isAddress(address);
    if (isValid) {
      ethersProvider.getCode(address).then((res) => {
        if (res === '0x') {
          console.log('normal');
          appendFileSync('./normal', address + ',' + total + '\n');
        } else {
          console.log('contract');
          appendFileSync('./contract', address + ',' + total + '\n');
        }
      });
    } else {
      console.log('invalid');
      appendFileSync('./invalid', address + ',' + total + '\n');
    }
  }
  // records.forEach(async (record, i) => {});
}

// eslint-disable-next-line no-unused-vars
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
