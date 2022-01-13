import { firestore } from '@base/container';
import { OrderDirection } from '@base/types/Queries';
import { StatusCode } from '@base/types/StatusCode';
import { DEFAULT_ITEMS_PER_PAGE, fstrCnstnts } from '@constants';
import { jsonString } from '@utils/formatters';
import { error, log } from '@utils/logger';
import { parseQueryFields } from '@utils/parsers';
import { Request, Router } from 'express';

const router = Router();

enum OrderBy {
  Twitter = 'twitter',
  Discord = 'discord',
  //   Votes = 'votes',
  Floor = 'floor',
  Volume = 'volume',
  //   Items = 'items',
  //   Owners = 'owners',
  AveragePrice = 'averagePrice'
}

enum Interval {
  OneDay = 'oneDay',
  SevenDay = 'sevenDay',
  ThirtyDay = 'thirtyDay',
  Total = 'total'
}

/**
 * twitter followers
 * discord followers
 * votes
 * price
 * volume
 * items
 * owners
 */
router.get(
  '/',
  async (
    req: Request<
      {},
      {},
      {},
      {
        startAfter: string;
        limit: string;
        orderDirection: OrderDirection;
        orderBy: OrderBy;
        interval: Interval;
      }
    >,
    res
  ) => {
    // const startAfter = req.query.startAfter ?? '';
    const queryFields = parseQueryFields(res, req, ['limit'], [`${DEFAULT_ITEMS_PER_PAGE}`]);
    if ('error' in queryFields) {
      return;
    }
    const limit = queryFields.limit;
    if (limit > 50 || limit <= 0) {
      res.sendStatus(StatusCode.BadRequest);
      return;
    }

    const orderDirection = req.query.orderDirection;

    if (orderDirection !== OrderDirection.Ascending && orderDirection !== OrderDirection.Descending) {
      res.send(StatusCode.BadRequest);
      return;
    }

    const interval = req.query.interval;

    if (
      interval !== Interval.OneDay &&
      interval !== Interval.SevenDay &&
      interval !== Interval.ThirtyDay &&
      interval !== Interval.Total
    ) {
      res.send(StatusCode.BadRequest);
      return;
    }

    const orderBy = req.query.orderBy;
    log(`Fetching stats for ${orderBy} ${orderDirection}`);

    try {
      let stats;

      switch (orderBy) {
        case OrderBy.AveragePrice:
          // eslint-disable-next-line no-case-declarations
          if (interval === Interval.Total) {
            stats = firestore.db
              .collectionGroup(fstrCnstnts.COLLECTION_STATS_COLL)
              .orderBy(`averagePrice`, orderDirection)
              .limit(limit);
          } else {
            stats = firestore.db
              .collectionGroup(fstrCnstnts.COLLECTION_STATS_COLL)
              .orderBy(`${interval}.averagePrice`, orderDirection)
              .limit(limit);
          }
          break;

        case OrderBy.Volume:
          stats = firestore.db
            .collectionGroup(fstrCnstnts.COLLECTION_STATS_COLL)
            .orderBy(`${interval}.volume`, orderDirection)
            .limit(limit);
          break;
        //   .where('opensea.averagePrice', '>=', 0)
        //   .orderBy('opensea.averagePrice', 'desc')
        //   .limit(50);

        // eslint-disable-next-line no-case-declarations

        //   case OrderBy.Discord:

        //   break;

        //   case OrderBy.Twitter:

        //   break;

        //   case OrderBy.Floor:

        //   case OrderBy.Volume:

        //   case OrderBy.Votes:

        //   case OrderBy.Items:

        //   case OrderBy.Owners:

        default:
          res.sendStatus(StatusCode.BadRequest);
          return;
      }

      const results = await stats.get();

      console.log(results);

      const data = (results.docs ?? []).map((item) => item.data());

      const respStr = jsonString(data);

      if (respStr) {
        res.set({
          'Cache-Control': 'must-revalidate, max-age=60',
          'Content-Length': Buffer.byteLength(respStr, 'utf8')
        });
      }

      res.send(respStr);
    } catch (err) {
      error('Error occurred while getting stats');
      error(err);
    }
  }
);

export default router;
