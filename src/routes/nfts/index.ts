import { Router } from 'express';

import { StatusCode } from '@base/types/StatusCode.js';
import metadataByTokenAddressAndTokenId from './:tokenAddress/:tokenId';

// todo: adi change this
import dogeAbi from '@base/abi/doge2048nft.json';

const router = Router();

router.get('/', async (req, res) => {
  res.send('nfts');
});

router.use('/:tokenAddress/:tokenId', metadataByTokenAddressAndTokenId);

router.post('nfts/:nft/mint', async (req, res) => {
  res.sendStatus(StatusCode.NotImplemented);
});

router.post('nfts/:nft/state', async (req, res) => {
  res.sendStatus(StatusCode.NotImplemented);
});

export default router;
