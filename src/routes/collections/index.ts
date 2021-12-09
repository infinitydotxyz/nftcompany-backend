import { firestore } from '@base/container';
import { StatusCode } from '@base/types/StatusCode';
import { fstrCnstnts } from '@constants';
import { getUniqueItemsByProperties } from '@utils/index.js';
import { getEndCode, getSearchFriendlyString, jsonString } from '@utils/formatters';
import { error } from '@utils/logger';
import { Router } from 'express';
import { getCollectionInfo } from './:slug';
import { getTraits } from './:id/traits';

const router = Router();

router.get('/:id/traits', getTraits);
router.get('/:slug', getCollectionInfo);

router.get('/', async (req, res) => {
  const startsWithOrig = req.query.startsWith;
  const startsWith = getSearchFriendlyString(startsWithOrig as string);
  if (startsWith && typeof startsWith === 'string') {
    const endCode = getEndCode(startsWith);
    firestore.db
      .collectionGroup(fstrCnstnts.LISTINGS_COLL)
      .where('metadata.asset.searchCollectionName', '>=', startsWith)
      .where('metadata.asset.searchCollectionName', '<', endCode)
      .orderBy('metadata.asset.searchCollectionName')
      .select('metadata.asset.address', 'metadata.asset.collectionName', 'metadata.hasBlueCheck')
      .limit(10)
      .get()
      .then((data) => {
        const resp = data.docs.map((doc) => {
          const docData = doc.data();
          return {
            address: docData.metadata.asset.address,
            collectionName: docData.metadata.asset.collectionName,
            hasBlueCheck: docData.metadata.hasBlueCheck
          };
        });
        // remove duplicates and take only the first 10 results
        const deDupresp = getUniqueItemsByProperties(resp, 'collectionName');
        const respStr = jsonString(deDupresp);
        // to enable cdn cache
        res.set({
          'Cache-Control': 'must-revalidate, max-age=60',
          'Content-Length': Buffer.byteLength(respStr, 'utf8')
        });
        res.send(respStr);
      })
      .catch((err) => {
        error('Failed to get collection names', err);
        res.sendStatus(StatusCode.InternalServerError);
      });
  } else {
    res.send(jsonString([]));
  }
});

export default router;
