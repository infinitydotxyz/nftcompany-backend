import { firestore } from '@base/container';
import { FEATURED_LIMIT, fstrCnstnts } from '@constants';
import { docsToArray, jsonString } from '@utils/formatters';
import { error, log } from '@utils/logger';
import { Router } from 'express';
const router = Router();

// get featured collections data. Data is imported from CSV file into DB using "firestore.js" script.
router.get('/featured-collections', async (req, res) => {
  log('fetch list of Featured Collections');
  try {
    const result = await firestore.collection(fstrCnstnts.FEATURED_COLL).limit(FEATURED_LIMIT).get();

    if (result.docs) {
      const { results: collections, count } = docsToArray(result.docs);
      const respStr = jsonString({ collections, count });
      res.set({
        'Cache-Control': 'must-revalidate, max-age=300',
        'Content-Length': Buffer.byteLength(respStr, 'utf8')
      });
      res.send(respStr);
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    error('Error fetching featured collections.');
    error(err);
    res.sendStatus(500);
  }
});

export default router;
