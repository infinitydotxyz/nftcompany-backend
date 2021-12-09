import { firestore } from '@base/container';
import { fstrCnstnts } from '@constants';
import { getEndCode, getSearchFriendlyString, jsonString } from '@utils/formatters';
import { error } from '@utils/logger';
import { Router } from 'express';
const router = Router();

router.get('/', async (req, res) => {
  const startsWithOrig = req.query.startsWith;
  const startsWith = getSearchFriendlyString(startsWithOrig as string);
  if (startsWith && typeof startsWith === 'string') {
    const endCode = getEndCode(startsWith);
    firestore.db
      .collectionGroup(fstrCnstnts.LISTINGS_COLL)
      .where('metadata.asset.searchTitle', '>=', startsWith)
      .where('metadata.asset.searchTitle', '<', endCode)
      .orderBy('metadata.asset.searchTitle')
      .select('metadata.asset.title', 'metadata.asset.address', 'metadata.asset.id')
      .limit(10)
      .get()
      .then((data) => {
        // to enable cdn cache
        const resp = data.docs.map((doc) => {
          return {
            title: doc.data().metadata.asset.title,
            id: doc.data().metadata.asset.id,
            address: doc.data().metadata.asset.address
          };
        });
        const respStr = jsonString(resp);
        res.set({
          'Cache-Control': 'must-revalidate, max-age=60',
          'Content-Length': Buffer.byteLength(respStr, 'utf8')
        });

        res.send(respStr);
      })
      .catch((err) => {
        error('Failed to get titles', err);
        res.sendStatus(500);
      });
  } else {
    res.send(jsonString([]));
  }
});

export default router;
