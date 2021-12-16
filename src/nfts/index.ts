require('dotenv').config();
import { ethers } from 'ethers';

import express from 'express';
const router = express.Router();

const utils = require('../../utils');
const constants = require('../../constants');
const fstrCnstnts = constants.firestore;
const firebaseAdmin = utils.getFirebaseAdmin();
const db = firebaseAdmin.firestore();

import { generateDoge2048NftMetadata, getDoge2048NftLevelId } from './metadataUtils';
import { uploadSourceImages, testUpload, urlForDogeImage } from './doge_builder/images';

// todo: adi change this
const dogeAbi = require('./abis/doge2048nft.json');

router.get('/', async (req, res) => {
  res.send('nfts');
});

// used for uploading the doge source images
// and testing creating and uploading an NFT based on metadata
// todo : adi remove in prod
router.get('/setup', async (req, res) => {
  try {
    // await uploadSourceImages();
    // res.send('uploaded');

    const result = await testUpload();
    res.send(result);
  } catch (err) {
    console.log(err);

    res.send(err);
  }
});

// api to get metadata
router.get('/:tokenAddress/:tokenId', async (req, res) => {
  const tokenAddress = req.params.tokenAddress.trim().toLowerCase();
  const tokenId = req.params.tokenId;
  const { chainId, score } = req.query;
  try {
    // read data from chain
    const provider = utils.getChainProvider(chainId);
    if (!provider) {
      utils.error('Chain provider is null for chain', chainId);
      res.sendStatus(500);
      return;
    }

    // todo: adi generalize this
    // todo: adi change this
    // const contract = new ethers.Contract(tokenAddress, dogeAbi, provider);
    // const score = contract.score();
    // const numPlays = contract.numPlays();
    // const dogBalance = contract.getTokenBalance();
    const finalScore: number = score ? parseInt(score as string) : 0;

    // const score = 1000;
    const numPlays = 10;
    const dogBalance = 10;
    const levelId = getDoge2048NftLevelId(finalScore, numPlays, dogBalance);
    // check if metadata already generated
    const snapshot = await db
      .collection(fstrCnstnts.ASSETS_COLL)
      .where('metadata.asset.address', '==', tokenAddress)
      .where('metadata.asset.id', '==', tokenId)
      .where('metadata.chainId', '==', chainId)
      .get();
    if (snapshot.docs.length > 0) {
      console.log(snapshot.docs);
    }

    const url = await urlForDogeImage(finalScore, numPlays, dogBalance);
    const result = { nftUrl: url };

    res.send(JSON.stringify(result));
  } catch (err) {
    utils.error('Failed fetching metadata for', tokenAddress, tokenId, chainId);
    utils.error(err);
    res.sendStatus(500);
  }
});

router.post('/:nft/mint', async (req, res) => {});

router.post('/:nft/state', async (req, res) => {});

export default router;
