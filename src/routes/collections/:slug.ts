import { firestore } from '@base/container';
import { StatusCode } from '@base/types/StatusCode';
import { fstrCnstnts } from '@constants';
import { jsonString } from '@utils/formatters';
import { error, log } from '@utils/logger';
import { Router } from 'express';
const router = Router();

router.get('/collections/:slug', async (req, res) => {
  const slug = req.params.slug;
  log('Fetching collection info for', slug);
  firestore
    .collection(fstrCnstnts.ALL_COLLECTIONS_COLL)
    .where('searchCollectionName', '==', slug)
    .limit(1)
    .get()
    .then((data) => {
      const resp = data.docs.map((doc) => {
        return doc.data();
      });
      const respStr = jsonString(resp);
      // to enable cdn cache
      res.set({
        'Cache-Control': 'must-revalidate, max-age=60',
        'Content-Length': Buffer.byteLength(respStr, 'utf8')
      });
      res.send(respStr);
    })
    .catch((err) => {
      error('Failed to get collection info for', slug, err);
      res.sendStatus(StatusCode.InternalServerError);
    });
});

export default router;
