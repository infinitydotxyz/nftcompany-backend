import { StatusCode } from '@infinityxyz/lib/types/core';
import { getPurchaseLeaders } from 'services/infinity/users/purchases/getPurchaseLeaders';
import { getSaleLeaders } from 'services/infinity/users/sales/getSaleLeaders';
import { error, jsonString } from '@infinityxyz/lib/utils';
import { Router } from 'express';
const router = Router();

// Fetch rewards leaderboard
router.get('/', async (req, res) => {
  try {
    const [saleLeaders, purchaseLeaders] = await Promise.all([getSaleLeaders(10), getPurchaseLeaders(10)]);

    const resp = {
      count: saleLeaders.length + purchaseLeaders.length,
      results: { saleLeaders, buyLeaders: purchaseLeaders }
    };
    const respStr = jsonString(resp);
    // To enable cdn cache
    res.set({
      'Cache-Control': 'must-revalidate, max-age=60',
      'Content-Length': Buffer.byteLength(respStr ?? '', 'utf8')
    });
    res.send(respStr);
  } catch (err: any) {
    error('Failed to get leaderboard');
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
});

export default router;
