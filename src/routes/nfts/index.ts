import { Router } from 'express';
import { firestore } from '../../container.js';

const router = Router();

import { generateDoge2048NftMetadata, getDoge2048NftLevelId } from './metadataUtils';
import { fstrCnstnts } from '@constants';
import { error } from '@utils/logger.js';
import { getChainProvider } from '@utils/ethers.js';
import { StatusCode } from '@base/types/StatusCode.js';

// todo: adi change this
const dogeAbi = require('./abis/doge2048nft.json');

router.get('/nfts', async (req, res) => {
  res.send('nfts');
});

// api to get metadata
router.get('nfts/:tokenAddress/:tokenId', async (req, res) => {
  const tokenAddress = req.params.tokenAddress.trim().toLowerCase();
  const tokenId = req.params.tokenId;
  const { chainId } = req.query;
  try {
    // read data from chain
    const provider = getChainProvider(chainId as string);
    if (!provider) {
      error('Chain provider is null for chain', chainId);
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
    const snapshot = await firestore
      .collection(fstrCnstnts.ASSETS_COLL)
      .where('metadata.asset.address', '==', tokenAddress)
      .where('metadata.asset.id', '==', tokenId)
      .where('metadata.chainId', '==', chainId)
      .get();
    if (snapshot.docs.length > 0) {
    }
    const metadataJson = generateDoge2048NftMetadata(score, numPlays, dogBalance);
  } catch (err) {
    error('Failed fetching metadata for', tokenAddress, tokenId, chainId);
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
});

router.post('nfts/:nft/mint', async (req, res) => {
  res.sendStatus(StatusCode.NotImplemented);
});

router.post('nfts/:nft/state', async (req, res) => {
  res.sendStatus(StatusCode.NotImplemented);
});

export default router;
