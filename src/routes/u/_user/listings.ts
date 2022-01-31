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
import { validateInputs, trimLowerCase } from '@utils/index';

// fetch listings of user
export const getUserListings = async (
  req: Request<
    { user: string },
    any,
    any,
    {
      chainId: string;
      listType: string;
      traitType: string;
      traitValue: string;
      collectionIds: string;
      startAfterBlueCheck: string;
      priceMin: string;
      priceMax: string;
      limit: string;
      startAfterPrice: string;
      startAfterMillis: string;
    }
  >,
  res: Response
) => {
  const { listType, traitType, traitValue, collectionIds, startAfterBlueCheck } = req.query;
  let { chainId } = req.query;
  if (!chainId) {
    chainId = '1'; // default eth mainnet
  }

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

  const user = trimLowerCase(req.params.user);
  const errorCode = validateInputs({ user, listType }, ['user']);
  if (errorCode) {
    res.sendStatus(errorCode);
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
      startAfterBlueCheck,
      queries.startAfterPrice,
      queries.startAfterMillis,
      queries.limit,
      listType as ListingType,
      traitType,
      traitValue,
      collectionIds
    );
    if (resp) {
      res.set({
        'Cache-Control': 'must-revalidate, max-age=60',
        'Content-Length': Buffer.byteLength(resp ?? '', 'utf8')
      });
    }
    res.send(resp);
  } catch (err) {
    error('Failed to get user listings for user ' + user);
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};
