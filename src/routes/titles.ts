import { StatusCode } from '@base/types/StatusCode';
import { fuzzySearchTitle } from '@services/infinity/collections/fuzzySearchTitle';
import { jsonString } from '@utils/formatters';
import { error } from '@utils/logger';
import { Router } from 'express';

const router = Router();

router.get('/', async (req, res) => {
  const startsWithOrig = req.query.startsWith;
  try {
    const resp = await fuzzySearchTitle(startsWithOrig as string, 10);
    const respStr = jsonString(resp);
    res.set({
      'Cache-Control': 'must-revalidate, max-age=60',
      'Content-Length': Buffer.byteLength(respStr, 'utf8')
    });

    res.send(respStr);
    return;
  } catch (err) {
    error('Failed to get titles', err);
    res.sendStatus(StatusCode.InternalServerError);
  }
});

export default router;
