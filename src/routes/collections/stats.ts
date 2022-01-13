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
  //   Floor = 'floor', // TODO add floor
  Volume = 'volume',
  AveragePrice = 'averagePrice'
}

enum Interval {
  OneDay = 'oneDay',
  SevenDay = 'sevenDay',
  ThirtyDay = 'thirtyDay',
  Total = 'total'
}

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
    const startAfter = req.query.startAfter ?? '';
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
      let statsQuery;

      switch (orderBy) {
        case OrderBy.AveragePrice:
          // eslint-disable-next-line no-case-declarations
          if (interval === Interval.Total) {
            statsQuery = firestore.db
              .collectionGroup(fstrCnstnts.COLLECTION_STATS_COLL)
              .orderBy(`averagePrice`, orderDirection);
          } else {
            statsQuery = firestore.db
              .collectionGroup(fstrCnstnts.COLLECTION_STATS_COLL)
              .orderBy(`${interval}.averagePrice`, orderDirection);
          }
          break;

        case OrderBy.Volume:
          statsQuery = firestore.db
            .collectionGroup(fstrCnstnts.COLLECTION_STATS_COLL)
            .orderBy(`${interval}.volume`, orderDirection);

          break;

        case OrderBy.Discord:
          if (interval === Interval.Total) {
            statsQuery = firestore.db
              .collectionGroup(fstrCnstnts.COLLECTION_STATS_COLL)
              .orderBy(`discordMembers`, orderDirection);
          } else {
            statsQuery = firestore.db
              .collectionGroup(fstrCnstnts.COLLECTION_STATS_COLL)
              .orderBy(`${interval}.discordMembers`, orderDirection);
          }

          break;

        case OrderBy.Twitter:
          if (interval === Interval.Total) {
            statsQuery = firestore.db
              .collectionGroup(fstrCnstnts.COLLECTION_STATS_COLL)
              .orderBy(`twitterFollowers`, orderDirection);
          } else {
            statsQuery = firestore.db
              .collectionGroup(fstrCnstnts.COLLECTION_STATS_COLL)
              .orderBy(`${interval}.twitterFollowers`, orderDirection);
          }

          break;

        default:
          res.sendStatus(StatusCode.BadRequest);
          return;
      }

      if (startAfter) {
        statsQuery = statsQuery.startAfter(startAfter);
      }

      const results = await statsQuery.limit(limit).get();

      const data = (results.docs ?? []).map((item) => {
        return item.data();
      });

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
