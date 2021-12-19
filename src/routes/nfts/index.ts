import { Router } from 'express';

import { StatusCode } from '@base/types/StatusCode.js';
import { getAssetMetadata } from './:chain/:tokenAddress/:tokenId';
import levelImages from './doge2048/level-images';

const router = Router();

router.get('/', async (req, res) => {
  res.send('nfts');
});

router.get('/:chain/:tokenAddress/:tokenId', getAssetMetadata);

router.get('/doge2048/level-images', levelImages);

router.post('nfts/:nft/mint', async (req, res) => {
  res.sendStatus(StatusCode.NotImplemented);
});

router.post('nfts/:nft/state', async (req, res) => {
  res.sendStatus(StatusCode.NotImplemented);
});

export default router;
