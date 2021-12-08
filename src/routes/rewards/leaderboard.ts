import { firestore } from '@base/container';
import { StatusCode } from '@base/types/StatusCode';
import { fstrCnstnts } from '@constants';
import { jsonString } from '@utils/formatters';
import { error } from '@utils/logger';
import { Router } from 'express';
const router = Router();

// fetch rewards leaderboard
router.get('/rewards/leaderboard', async (req, res) => {
  try {
    const sales = await firestore
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.USERS_COLL)
      .orderBy('salesTotalNumeric', 'desc')
      .limit(10)
      .get();

    const saleLeaders = [];
    for (const doc of sales.docs) {
      const docData = doc.data();
      const result = {
        id: doc.id,
        total: docData.salesTotalNumeric
      };
      saleLeaders.push(result);
    }

    const buys = await firestore
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.USERS_COLL)
      .orderBy('purchasesTotalNumeric', 'desc')
      .limit(10)
      .get();

    const buyLeaders = [];
    for (const doc of buys.docs) {
      const docData = doc.data();
      const result = {
        id: doc.id,
        total: docData.purchasesTotalNumeric
      };
      buyLeaders.push(result);
    }

    const resp = {
      count: saleLeaders.length + buyLeaders.length,
      results: { saleLeaders, buyLeaders }
    };
    const respStr = jsonString(resp);
    // to enable cdn cache
    res.set({
      'Cache-Control': 'must-revalidate, max-age=60',
      'Content-Length': Buffer.byteLength(respStr, 'utf8')
    });
    res.send(respStr);
  } catch (err) {
    error('Failed to get leaderboard');
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
});

export default router;
