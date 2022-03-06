import { StatusCode } from '@infinityxyz/types/core/StatusCode';
import { getVerifiedCollectionIds } from '@services/infinity/collections/getVerifiedCollectionIds';
import { validateInputs } from '@utils/index';
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
  const forIds = (ids ?? '').split(',') || [];

  try {
    const collectionIds = await getVerifiedCollectionIds();

    const idsArray = collectionIds.filter((id: string) => {
      return forIds.includes(id);
    });

    const respObj = {
      collectionIds: idsArray
    };
    res.send(respObj);
  } catch (err) {
    error(`error in /collections/verifiedIds`);
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
});

export default router;
