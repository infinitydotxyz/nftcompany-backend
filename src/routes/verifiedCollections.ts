import { StatusCode } from '@infinityxyz/types/core/StatusCode';
import { getVerifiedCollections } from '@services/infinity/collections/getVerifiedCollections';
import { jsonString } from '@utils/formatters';
import { error } from '@utils/logger';
import { Router } from 'express';
const router = Router();

/**
 * @typedef {Object} VerifiedCollection
 * @property {string} openseaUrl
 * @property {string} chainId
 * @property {string} cardImage
 * @property {string} description
 * @property {string} bannerImage
 * @property {string} name
 * @property {string} address
 * @property {string} id
 * @property {string} searchCollectionName
 * @property {string} profileImage
 * @property {boolean} hasBlueCheck
 * @property {string} chain
 */

/**
 * @typedef {Object} VerifiedCollectionsResponse
 * @property {number} count
 * @property {array<VerifiedCollection>} collections
 */

/**
 * GET /verifiedCollections
 * @tags collections
 * @deprecated
 * @summary Get verified collections
 * @description Get a list of verified collections
 * @param {string} startAfterName.query - used for pagination, pass in the last collection name received to get the next page
 * @param {string} limit.query - number of collections to get
 * @return {VerifiedCollectionsResponse} 200 - Success response
 * @return 500 - Server error response
 */
router.get('/', async (req, res) => {
  const startAfterName = req.query.startAfterName ?? '';
  const limit = +(req.query.limit ?? 50);

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
      'Content-Length': Buffer.byteLength(resp ?? '', 'utf8')
    });
    res.send(resp);
  } catch (err) {
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
});

export default router;
