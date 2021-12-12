import { StatusCode } from '@base/types/StatusCode';
import { getVerifiedCollections } from '@services/infinity/collections/getVerifiedCollections';
import { jsonString } from '@utils/formatters';
import { error } from '@utils/logger';
import { Router } from 'express';
const router = Router();

router.get('/', async (req, res) => {
  const startAfterName = req.query.startAfterName || '';
  const limit = +(req.query.limit || 50);

  try {
    const collections = await getVerifiedCollections(limit, startAfterName as string);

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
