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

// todo: adi change this
const dogeAbi = require('./abis/doge2048nft.json');

router.get('/', async (req, res) => {
  res.send('nfts');
});

// api to get metadata
router.get('/:tokenAddress/:tokenId', async (req, res) => {
  const tokenAddress = req.params.tokenAddress.trim().toLowerCase();
  const tokenId = req.params.tokenId;
  const { chainId } = req.query;
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
    const score = 1000;
    const numPlays = 10;
    const dogBalance = 10;
    const levelId = getDoge2048NftLevelId(score, numPlays, dogBalance);
    // check if metadata already generated
    const snapshot = await db
      .collection(fstrCnstnts.ASSETS_COLL)
      .where('metadata.asset.address', '==', tokenAddress)
      .where('metadata.asset.id', '==', tokenId)
      .where('metadata.chainId', '==', chainId)
      .get();
      if (snapshot.docs.length > 0) {

      }
    const metadataJson = generateDoge2048NftMetadata(score, numPlays, dogBalance);
  } catch (err) {
    utils.error('Failed fetching metadata for', tokenAddress, tokenId, chainId);
    utils.error(err);
    res.sendStatus(500);
  }
});

router.post('/:nft/mint', async (req, res) => {});

router.post('/:nft/state', async (req, res) => {});

export default router;
