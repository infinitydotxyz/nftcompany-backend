import { firestore } from '@base/container';
import { StatusCode } from '@base/types/StatusCode';
import { fstrCnstnts } from '@constants';
import { jsonString } from '@utils/formatters';
import { error } from '@utils/logger';
import { Router } from 'express';
const router = Router();

router.get('/verifiedCollections', async (req, res) => {
  const startAfterName = req.query.startAfterName || '';
  const limit = +(req.query.limit || 50);

  try {
    let query = firestore
      .collection(fstrCnstnts.ALL_COLLECTIONS_COLL)
      .where('hasBlueCheck', '==', true)
      .orderBy('name', 'asc');

    if (startAfterName) {
      query = query.startAfter(startAfterName);
    }

    const data = await query.limit(limit).get();

    const collections = [];
    for (const doc of data.docs) {
      const data = doc.data();

      data.id = doc.id;
      collections.push(data);
    }

    const dataObj = {
      count: collections.length,
      collections
    };

    const resp = jsonString(dataObj);
    // to enable cdn cache
    res.set({
      'Cache-Control': 'must-revalidate, max-age=600',
      'Content-Length': Buffer.byteLength(resp, 'utf8')
    });
    res.send(resp);
  } catch (err) {
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
});

export default router;
