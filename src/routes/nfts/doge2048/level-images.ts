import { StatusCode } from '@base/types/StatusCode';
import { error } from '@utils/logger';
import { Router } from 'express';
import { urlForDogeImage } from '../doge_builder/images';

const router = Router();

router.get('/', async (req, res) => {
  const { score, numPlays, dogBalance } = req.query;
  try {
    const finalScore: number = score ? parseInt(score as string) : 0;
    const finalNumPlays: number = numPlays ? parseInt(numPlays as string) : 1;
    const finalDogBalance: number = dogBalance ? parseInt(dogBalance as string) : 1;
    const url = await urlForDogeImage(finalScore, finalNumPlays, finalDogBalance);
    const result = { image: url };
    res.send(JSON.stringify(result));
  } catch (err) {
    error('Failed fetching grid images');
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
});

export default router;
