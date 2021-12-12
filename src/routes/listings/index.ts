import { ListingType } from '@base/types/NftInterface';
import { StatusCode } from '@base/types/StatusCode';
import { DEFAULT_ITEMS_PER_PAGE, DEFAULT_MAX_ETH, DEFAULT_MIN_ETH, DEFAULT_PRICE_SORT_DIRECTION } from '@constants';
import { parseQueryFields } from '@utils/parsers.js';
import { error } from '@utils/logger.js';
import { Router } from 'express';
import importListings from './import';
import {
  getListingsByCollectionNameAndPrice,
  getListingsStartingWithText
} from '@services/infinity/listings/getListings';
import { getListingsByCollection } from '@services/infinity/listings/getListingsByCollection';
import { getListingByTokenAddressAndId } from '@services/infinity/listings/getListingsByTokenAddressAndId';
import { OrderDirection } from '@base/types/Queries';

const router = Router();

router.use('/import', importListings);

// fetch listings (for Explore page)
/*
- supports the following queries - from most to least restrictive
- supports tokenId and tokenAddress query
- supports collectionName, priceMin and priceMax query ordered by price
- supports all listings
- support title
*/
router.get('/', async (req, res) => {
  const { tokenId, listType, traitType, traitValue, collectionIds } = req.query;
  let { chainId } = req.query;
  if (!chainId) {
    chainId = '1'; // default eth mainnet
  }
  // @ts-ignore
  const tokenAddress = (req.query.tokenAddress || '').trim().toLowerCase();
  // @ts-ignore
  const collectionName = (req.query.collectionName || '').trim(); // preserve case
  // @ts-ignore
  const text = (req.query.text || '').trim(); // preserve case
  // @ts-ignore
  const startAfterSearchTitle = (req.query.startAfterSearchTitle || '').trim();
  const startAfterBlueCheck = req.query.startAfterBlueCheck;
  // @ts-ignore
  const startAfterSearchCollectionName = (req.query.startAfterSearchCollectionName || '').trim();
  // @ts-ignore

  let priceMin = +(req.query.priceMin || 0);
  let priceMax = +(req.query.priceMax || 0);
  // @ts-ignore
  const sortByPriceDirection = (req.query.sortByPrice || '').trim().toLowerCase() || DEFAULT_PRICE_SORT_DIRECTION;
  const {
    limit,
    startAfterPrice,
    startAfterMillis,
    error: err
  } = parseQueryFields(
    res,
    req,
    ['limit', 'startAfterPrice', 'startAfterMillis'],
    [
      `${DEFAULT_ITEMS_PER_PAGE}`,
      sortByPriceDirection === OrderDirection.Ascending ? '0' : `${DEFAULT_MAX_ETH}`,
      `${Date.now()}`
    ]
  ) as { limit?: number; startAfterPrice?: number; startAfterMillis?: number; error?: Error };
  if (err) {
    return;
  }

  if (
    listType &&
    listType !== ListingType.FixedPrice &&
    listType !== ListingType.DutchAuction &&
    listType !== ListingType.EnglishAuction
  ) {
    error('Input error - invalid list type');
    res.sendStatus(StatusCode.InternalServerError);
    return;
  }

  let resp;
  if (tokenAddress && tokenId) {
    resp = await getListingByTokenAddressAndId(chainId as string, tokenId as string, tokenAddress, limit);
    if (resp) {
      res.set({
        'Cache-Control': 'must-revalidate, max-age=60',
        'Content-Length': Buffer.byteLength(resp, 'utf8')
      });
    }
  } else if (text) {
    resp = await getListingsStartingWithText(
      text,
      limit,
      startAfterSearchTitle,
      startAfterSearchCollectionName,
      startAfterMillis,
      startAfterPrice,
      sortByPriceDirection
    );
    if (resp) {
      res.set({
        'Cache-Control': 'must-revalidate, max-age=60',
        'Content-Length': Buffer.byteLength(resp, 'utf8')
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
      startAfterPrice,
      startAfterMillis,
      limit,
      listType as ListingType,
      traitType as string,
      traitValue as string,
      collectionIds as string
    );
    if (resp) {
      res.set({
        'Cache-Control': 'must-revalidate, max-age=60',
        'Content-Length': Buffer.byteLength(resp, 'utf8')
      });
    }
  } else {
    resp = await getListingsByCollection(startAfterBlueCheck as string, startAfterSearchCollectionName, limit);
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
