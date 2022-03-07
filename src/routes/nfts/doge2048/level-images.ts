import { StatusCode } from '@infinityxyz/types/core';
import { error } from 'utils/logger';
import { Router } from 'express';
import { metadataForDoge2048Nft } from '../doge_builder/images';

const router = Router();

router.get('/', async (req, res) => {
  const { score, numPlays, dogBalance, tokenAddress, chainId } = req.query;
  try {
    const finalScore: number = score ? parseInt(score as string) : 0;
    const finalNumPlays: number = numPlays ? parseInt(numPlays as string) : 1;
    const finalDogBalance: number = dogBalance ? parseInt(dogBalance as string) : 1;
    const metadata = await metadataForDoge2048Nft(
      chainId as string,
      tokenAddress as string,
      0,
      finalScore,
      finalNumPlays,
      finalDogBalance
    );
    const result = { image: metadata.image };
    res.send(JSON.stringify(result));
  } catch (err) {
    error('Failed fetching grid images');
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
});

export default router;
