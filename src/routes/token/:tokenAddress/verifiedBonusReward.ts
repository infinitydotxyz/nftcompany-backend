import { Router } from 'express';
import { hasBonusReward, isTokenVerified } from '@services/firestore.js';
import { jsonString } from '@utils/formatters.js';
import { error } from '@utils/logger.js';

const router = Router();

// check if token is verified or has bonus reward
router.get('/', async (req, res) => {
  console.log(req.params);
  // const tokenAddress = (`${req.params.tokenAddress}` || '').trim().toLowerCase();
  const tokenAddress = '';
  if (!tokenAddress) {
    error('Empty token address');
    res.sendStatus(500);
    return;
  }
  try {
    const verified = await isTokenVerified(tokenAddress);
    const bonusReward = await hasBonusReward(tokenAddress);
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
    res.sendStatus(500);
  }
});

export default router;
