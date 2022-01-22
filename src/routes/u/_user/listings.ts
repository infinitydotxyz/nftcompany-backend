import { OrderDirection } from '@base/types/Queries';
import { StatusCode } from '@base/types/StatusCode';
import { error } from '@utils/logger';
import { parseQueryFields } from '@utils/parsers';
import { Request, Response } from 'express';
import {
  DEFAULT_ITEMS_PER_PAGE,
  DEFAULT_MAX_ETH,
  DEFAULT_MIN_ETH,
  DEFAULT_PRICE_SORT_DIRECTION
} from '@base/constants';
import { ListingType } from '@base/types/NftInterface';
import { getFilteredUserListings } from '@services/infinity/listings/getUserListing';

// fetch listings of user
export const getUserListings = async (req: Request<{ user: string }>, res: Response) => {
  const { listType, traitType, traitValue, collectionIds } = req.query;
  let { chainId } = req.query;
  if (!chainId) {
    chainId = '1'; // default eth mainnet
  }
  const startAfterBlueCheck = req.query.startAfterBlueCheck;

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

  const user = (`${req.params.user}` || '').trim().toLowerCase();
  if (!user) {
    error('Empty user');
    res.sendStatus(StatusCode.BadRequest);
    return;
  }

  try {
    if (!priceMin) {
      priceMin = DEFAULT_MIN_ETH;
    }
    if (!priceMax) {
      priceMax = DEFAULT_MAX_ETH;
    }
    const resp = await getFilteredUserListings(
      user,
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
        'Content-Length': Buffer.byteLength(resp, 'utf8')
      });
    }
    res.send(resp);
  } catch (err) {
    error('Failed to get user listings for user ' + user);
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};
