import { ListingType } from '@base/types/NftInterface';
import { StatusCode } from '@base/types/StatusCode';
import {
  DEFAULT_ITEMS_PER_PAGE,
  DEFAULT_MAX_ETH,
  DEFAULT_MIN_ETH,
  DEFAULT_PRICE_SORT_DIRECTION
} from '@base/constants';
import { parseQueryFields } from '@utils/parsers';
import { Router } from 'express';
import importListings from './import';
import {
  getListingsByCollectionNameAndPrice,
  getListingsStartingWithText
} from '@services/infinity/listings/getListings';
import { getListingsByCollection } from '@services/infinity/listings/getListingsByCollection';
import { getListingByTokenAddressAndId } from '@services/infinity/listings/getListingsByTokenAddressAndId';
import { OrderDirection } from '@base/types/Queries';
import { validateInputs } from '@utils/index';

const router = Router();

router.use('/import', importListings);

/**
 * @typedef {Object} ListingsResponse
 * @property {number} count
 * @property {array<object>} listings
 */

/**
 * GET /listings
 * @tags listings
 * @summary Get listing
 * @description Get listings
 * ### Queries (ordered from most to least restrictive)
 * - supports tokenId and tokenAddress query
 * - supports collectionName, priceMin and priceMax query ordered by price
 * - supports all listings
 * - support title
 * ### Pagination
 * - startAfterSearchTitle
 * - startAfterBlueCheck
 * - startAfterSearchCollectionName
 * - startAfterPrice
 * - startAfterMillis
 * ### Sorting
 * - sortByPrice - asc or desc
 * @param {string} tokenId.query
 * @param {string} tokenAddress.query
 * @param {string} collectionName.query
 * @param {string} listType.query - fixedPrice | dutchAuction | englishAuction
 * @param {string} traitType.query
 * @param {string} traitValue.query
 * @param {string} collectionIds.query - string of comma separated collection ids
 * @param {string} chainId.query
 * @param {string} text.query
 * @param {string} startAfterSearchTitle.query
 * @param {boolean} startAfterBlueCheck.query
 * @param {string} startAfterSearchCollectionName.query
 * @param {number} startAterPrice.query
 * @param {number} startAfterMillis.query
 * @param {number} priceMin.query
 * @param {number} priceMax.query
 * @param {string} sortByPrice.query - asc | desc
 * @param {number} limit.query - number of listings to get
 * @return {ListingsResponse} 200 - Success response
 * @return 400 - Bad request response
 * @return 500 - Server error response
 */
router.get('/', async (req, res) => {
  const { tokenId, listType, traitType, traitValue, collectionIds } = req.query;
  let { chainId } = req.query;
  if (!chainId) {
    chainId = '1'; // default eth mainnet
  }
  // @ts-expect-error
  const tokenAddress = (req.query.tokenAddress ?? '').trim().toLowerCase();
  // @ts-expect-error
  const collectionName = (req.query.collectionName ?? '').trim(); // preserve case
  // @ts-expect-error
  const text = (req.query.text ?? '').trim(); // preserve case
  // @ts-expect-error
  const startAfterSearchTitle = (req.query.startAfterSearchTitle ?? '').trim();
  const startAfterBlueCheck = req.query.startAfterBlueCheck;
  // @ts-expect-error
  const startAfterSearchCollectionName = (req.query.startAfterSearchCollectionName ?? '').trim();

  let priceMin = +(req.query.priceMin ?? 0);
  let priceMax = +(req.query.priceMax ?? 0);
  // @ts-expect-error
  const sortByPriceDirection = (req.query.sortByPrice ?? '').trim().toLowerCase() || DEFAULT_PRICE_SORT_DIRECTION;
  const queries = parseQueryFields(
    res,
    req,
    ['limit', 'startAfterPrice', 'startAfterMillis'],
    [
      `${DEFAULT_ITEMS_PER_PAGE}`,
      sortByPriceDirection === OrderDirection.Ascending ? '0' : `${DEFAULT_MAX_ETH}`,
      `${Date.now()}`
    ]
  );
  if ('error' in queries) {
    return;
  }

  const errorCode = validateInputs({ listType });
  if (errorCode) {
    res.sendStatus(errorCode);
    return
  }

  let resp;
  if (tokenAddress && tokenId) {
    resp = await getListingByTokenAddressAndId(chainId as string, tokenId as string, tokenAddress, queries.limit);
    if (resp) {
      res.set({
        'Cache-Control': 'must-revalidate, max-age=60',
        'Content-Length': Buffer.byteLength(resp ?? '', 'utf8')
      });
    }
  } else if (text) {
    resp = await getListingsStartingWithText(
      text,
      queries.limit,
      startAfterSearchTitle,
      startAfterSearchCollectionName,
      queries.startAfterMillis,
      queries.startAfterPrice,
      sortByPriceDirection
    );
    if (resp) {
      res.set({
        'Cache-Control': 'must-revalidate, max-age=60',
        'Content-Length': Buffer.byteLength(resp ?? '', 'utf8')
      });
    }
  } else if (collectionName || priceMin || priceMax || listType || collectionIds) {
    if (!priceMin) {
      priceMin = DEFAULT_MIN_ETH;
    }
    if (!priceMax) {
      priceMax = DEFAULT_MAX_ETH;
    }
    resp = await getListingsByCollectionNameAndPrice(
      collectionName,
      priceMin,
      priceMax,
      sortByPriceDirection,
      startAfterBlueCheck as string,
      queries.startAfterPrice,
      queries.startAfterMillis,
      queries.limit,
      listType as ListingType,
      traitType as string,
      traitValue as string,
      collectionIds as string
    );
    if (resp) {
      res.set({
        'Cache-Control': 'must-revalidate, max-age=60',
        'Content-Length': Buffer.byteLength(resp ?? '', 'utf8')
      });
    }
  } else {
    resp = await getListingsByCollection(startAfterBlueCheck as string, startAfterSearchCollectionName, queries.limit);
    if (resp) {
      res.set({
        'Cache-Control': 'must-revalidate, max-age=60',
        'Content-Length': Buffer.byteLength(resp, 'utf8')
      });
    }
  }

  if (resp) {
    res.send(resp);
  } else {
    res.sendStatus(StatusCode.InternalServerError);
  }
});

export default router;
