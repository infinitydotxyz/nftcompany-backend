import { StatusCode } from '@base/types/StatusCode';
import { getUniqueItemsByProperties } from '@utils/index.js';
import { jsonString } from '@utils/formatters';
import { error } from '@utils/logger';
import { Router } from 'express';
import { getCollectionInfo } from './:slug';
import { getTraits } from './:id/traits';
import { fuzzySearchCollection } from '@services/infinity/collections/fuzzySearchCollection';
import featured from './featured';

const router = Router();

router.get('/:id/traits', getTraits);
router.get('/:slug', getCollectionInfo);
router.get('/featured', featured);

router.get('/', async (req, res) => {
  const startsWithOrig = req.query.startsWith;

  try {
    const { success, data, error: err } = await fuzzySearchCollection(startsWithOrig as string, 10);

    if (success) {
      const deDupresp = getUniqueItemsByProperties(data, 'collectionName');
      const respStr = jsonString(deDupresp);
      // to enable cdn cache
      res.set({
        'Cache-Control': 'must-revalidate, max-age=60',
        'Content-Length': Buffer.byteLength(respStr, 'utf8')
      });
      res.send(respStr);
      return;
    }

    error('Failed to get collection names', err);
    res.sendStatus(StatusCode.InternalServerError);
    return;
  } catch (err) {
    error('Failed to get collection names', err);
    res.sendStatus(StatusCode.InternalServerError);
  }
});

export default router;
