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

// todo: adi constants
const dogTokenAddress = '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6';
const tokensPerPlay = 1;
const signerAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

router.all('/u/*', async (req, res, next) => {
  const authorized = await utils.authorizeUser(
    req.path,
    req.header(constants.auth.signature),
    req.header(constants.auth.message)
  );
  if (authorized) {
    next();
  } else {
    res.status(401).send('Unauthorized');
  }
});

router.get('/', async (req, res) => {
  res.send('nfts');
});

// used for uploading the doge source images
// and testing creating and uploading an NFT based on metadata
// todo : adi remove in prod
router.get('/setup', async (req, res) => {
  try {
    await uploadSourceImages();
    res.send('uploaded');

    // const result = await testUpload();
    // res.send(result);
  } catch (err) {
    console.log(err);

    res.send(err);
  }
});

// api to get metadata
router.get('/:chain/:tokenAddress/:tokenId', async (req, res) => {
  const tokenAddress = req.params.tokenAddress.trim().toLowerCase();
  const tokenId = req.params.tokenId;
  const { chainId, score, numPlays } = req.query;
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
    const finalNumPlays: number = numPlays ? parseInt(numPlays as string) : 1;

    // const score = 1000;
    // const numPlays = 10;
    const dogBalance = 10;
    const levelId = getDoge2048NftLevelId(finalScore, finalNumPlays, dogBalance);
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

    const url = await urlForDogeImage(finalScore, finalNumPlays, dogBalance);
    const result = { nftUrl: url };

    res.send(JSON.stringify(result));
  } catch (err) {
    utils.error('Failed fetching metadata for', tokenAddress, tokenId, chainId);
    utils.error(err);
    res.sendStatus(500);
  }
});

router.post('/u/:user/:chain/:instanceAddress/state', async (req, res) => {
  // TODO: Adi update the NFT state
  const { chain, instanceAddress, user } = req.params;
  const { score } = req.body;
  const address = user.trim().toLowerCase();
  try {
    const chainId = utils.getChainId(chain);
    const provider = utils.getChainProvider(chainId);
    const signer = new ethers.Wallet(process.env.doge2048PrivKey, provider);
    const contract = new ethers.Contract(instanceAddress, dogeAbi, signer);

    // save state to chain
    contract.saveState(dogTokenAddress, tokensPerPlay, score, signerAddress);

    // save state to firestore
    // todo: adi use constants
    const ref = db.collecton('games/all/polygon/users').doc(address);
    const data = await ref.get();
    let scoreUpdate = data.score;
    if (score > scoreUpdate) {
      scoreUpdate = score;
    }
    const obj = {
      score: scoreUpdate,
      numPlays: firebaseAdmin.firestore.FieldValue.increment(1)
    };
    ref
      .set(obj, { merge: true })
      .catch((err: any) => utils.error('Error updating score in firestore for user', address, err));
  } catch (err) {
    utils.error('Error saving game state for nft instance', instanceAddress, err);
  }
});

export default router;
