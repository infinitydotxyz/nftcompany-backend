require('dotenv').config();
const { ethers } = require('ethers');
const utils = require('./utils');
const ethersProvider = new ethers.providers.JsonRpcProvider(process.env.alchemyJsonRpcEthMainnet);

async function run() {
  const txnHash = '0xf0ac6805ecc5da569b204e6f7fa589f2ff4d70dca27016d364b141f391c5868f';
  const confirms = 1;
  try {
    const receipt = await ethersProvider.waitForTransaction(txnHash, confirms);
    // const receipt = await ethersProvider.getTransactionReceipt(txnHash);
    utils.log(utils.jsonString(receipt));
  } catch (err) {
    utils.error(err);
    if (err.receipt && err.receipt.status === 0) {
      utils.error('Txn with hash: ' + txnHash + ' rejected');
      utils.error(err);
    }
    // if the txn failed due to replacement or cancellation or repricing
    if (err && err.reason && err.replacement) {
      utils.error('Txn with hash: ' + txnHash + ' rejected with reason ' + err.reason);
      utils.error(err);

      const replacementTxnHash = err.replacement.hash;
      // write a new pending txn in firestore
      utils.log('Writing replacement txn: ' + replacementTxnHash + ' to firestore');
    }
  }
}

run();
