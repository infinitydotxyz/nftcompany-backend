import { StatusCode } from '@infinityxyz/lib/types/core';
import { FEATURED_LIMIT } from '../constants';
import { getFeaturedCollectionsRef } from 'services/infinity/collections/getFeaturedCollections';
import { docsToArray } from 'utils/formatters';
import { Router } from 'express';
import { error, jsonString, log } from '@infinityxyz/lib/utils';
const router = Router();

// Get featured collections data. Data is imported from CSV file into DB using "firestore.js" script.

/**
 * @typedef {Object} FeaturedCollection
 * @property {string} openseaUrl
 * @property {string} chainId
 * @property {string} cardImage
 * @property {string} description
 * @property {string} bannerImage
 * @property {string} name
 * @property {string} address
 * @property {string} id
 */

/**
 * @typedef {Object} FeaturedCollectionsResponse
 * @property {number} count
 * @property {array<FeaturedCollection>} collections
 */

/**
 * GET /featured-collections
 * @tags collections
 * @deprecated
 * @summary Get featured collections
 * @description Get a list of featured collections
 * @return {FeaturedCollectionsResponse} 200 - Success response
 * @return 500 - Server error response
 */
router.get('/', async (req, res) => {
  log('fetch list of Featured Collections');
  try {
    const result = await getFeaturedCollectionsRef(FEATURED_LIMIT).get();

    if (result.docs) {
      const { results: collections, count } = docsToArray(result.docs);
      const respStr = jsonString({ collections, count });
      res.set({
        'Cache-Control': 'must-revalidate, max-age=300',
        'Content-Length': Buffer.byteLength(respStr ?? '', 'utf8')
      });
      res.send(respStr);
      return;
    }
    res.sendStatus(StatusCode.InternalServerError);
  } catch (err) {
    error('Error fetching featured collections.');
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
});

export default router;
