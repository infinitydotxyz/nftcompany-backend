import { StatusCode } from '@base/types/StatusCode';
import { getPurchaseLeaders } from '@services/infinity/users/purchases/getPurchaseLeaders';
import { getSaleLeaders } from '@services/infinity/users/sales/getSaleLeaders';
import { jsonString } from '@utils/formatters';
import { error } from '@utils/logger';
import { Router } from 'express';
const router = Router();

// fetch rewards leaderboard
router.get('/', async (req, res) => {
  try {
    const [saleLeaders, purchaseLeaders] = await Promise.all([getSaleLeaders(10), getPurchaseLeaders(10)]);

    const resp = {
      count: saleLeaders.length + purchaseLeaders.length,
      results: { saleLeaders, buyLeaders: purchaseLeaders }
    };
    const respStr = jsonString(resp);
    // to enable cdn cache
    res.set({
      'Cache-Control': 'must-revalidate, max-age=60',
      'Content-Length': Buffer.byteLength(respStr ?? '', 'utf8')
    });
    res.send(respStr);
  } catch (err) {
    error('Failed to get leaderboard');
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
});

export default router;
