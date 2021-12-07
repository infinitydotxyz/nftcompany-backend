import { Request, Response, Router } from 'express';
import { jsonString } from '@utils/formatters.js';
import { error } from '@utils/logger.js';
import { StatusCode } from '@base/types/StatusCode';
import { hasBonusReward, isTokenVerified } from '..';

const router = Router();

// check if token is verified or has bonus reward
router.get('/:tokenAddress/verifiedBonusReward', async (req: Request, res: Response) => {
  const tokenAddress = (`${req.params.tokenAddress}` || '').trim().toLowerCase();

  if (!tokenAddress) {
    error('Empty token address');
    res.sendStatus(500);
    return;
  }

  try {
    const [verified, bonusReward] = await Promise.all([isTokenVerified(tokenAddress), hasBonusReward(tokenAddress)]);

    const resp = {
      verified,
      bonusReward
    };

    const respStr = jsonString(resp);

    // to enable cdn cache
    res.set({
      'Cache-Control': 'must-revalidate, max-age=3600',
      'Content-Length': Buffer.byteLength(respStr, 'utf8')
    });
    res.send(respStr);
  } catch (err) {
    error('Error in checking whether token: ' + tokenAddress + ' is verified or has bonus');
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
});

export default router;
