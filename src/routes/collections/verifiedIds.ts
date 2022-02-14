import { StatusCode } from '@base/types/StatusCode';
import { getVerifiedCollectionIds } from '@services/infinity/collections/getVerifiedCollectionIds';
import { validateInputs } from '@utils/index';
import { jsonString } from '@utils/formatters';
import { error } from '@utils/logger';
import { Request, Router, Response } from 'express';

const router = Router();

/**
 * @typedef {Object} VerifiedCollectionIdsResponse
 * @property {array<string>} collectionIds
 */

/**
 * GET /collections/verifiedIds
 * @tags collections
 * @summary Get verified collection Ids
 * @description Get a list of verified collection Ids
 * @param {string} ids - list of Collection Ids need to verify (comma separated string)
 * @return {VerifiedCollectionIdsResponse} 200 - Success response
 * @return 500 - Server error response
 */
router.get('/', async (req: Request<any, any, any, { ids?: string }>, res: Response) => {
  const { ids } = req.query;
  const errorCode = validateInputs({ ids }, ['ids']);
  if (errorCode) {
    res.sendStatus(errorCode);
    return;
  }
  const forIds = (ids ?? '').split(',');

  try {
    const collectionIds: string = await getVerifiedCollectionIds({ forIds });

    const dataObj = {
      collectionIds
    };

    const resp = jsonString(dataObj);
    // to enable cdn cache
    res.set({
      'Cache-Control': 'must-revalidate, max-age=600',
      'Content-Length': Buffer.byteLength(resp ?? '', 'utf8')
    });
    res.send(resp);
  } catch (err) {
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
});

export default router;
