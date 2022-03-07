import {
  DEFAULT_ITEMS_PER_PAGE,
  DEFAULT_MAX_ETH,
  DEFAULT_MIN_ETH,
  DEFAULT_PRICE_SORT_DIRECTION
} from '../../../constants';
import { OrderDirection, StatusCode } from '@infinityxyz/types/core';
import { getFilteredUserOffersMade } from 'services/infinity/users/offers/getUserOffersRef';
import { error } from 'utils/logger';
import { parseQueryFields } from 'utils/parsers';
import { Request, Response } from 'express';
import { trimLowerCase } from 'utils';

// fetch offer made by user
export const getUserOffersMade = async (
  req: Request<
    { user: string },
    any,
    any,
    {
      chainId: string;
      traitType: string;
      traitValue: string;
      collectionIds: string;
      startAfterBlueCheck: string;
      priceMin: string;
      priceMax: string;
    }
  >,
  res: Response
) => {
  const { traitType, traitValue, collectionIds } = req.query;
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

  const user = trimLowerCase(req.params.user);
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
    const resp = await getFilteredUserOffersMade(
      user,
      chainId,
      priceMin,
      priceMax,
      sortByPriceDirection,
      startAfterBlueCheck,
      queries.startAfterPrice,
      queries.startAfterMillis,
      queries.limit,
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
    error(`Failed to get offers made by user ${user}`);
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};
