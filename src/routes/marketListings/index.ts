import {
  BuyOrder,
  BuyOrderMatch,
  MarketListingsBody,
  MarketListingsResponse,
  SellOrder,
  StatusCode
} from '@infinityxyz/lib/types/core';
import { Request, Response, Router } from 'express';
import { error } from '@infinityxyz/lib/utils';
import { marketListingsCache } from './marketListingsCache';
import { marketOrders } from './marketOrders';

const post = async (req: Request<any, any, MarketListingsBody>, res: Response<MarketListingsResponse>) => {
  try {
    if (badRequest(req, res)) {
      res.sendStatus(StatusCode.BadRequest);
      return;
    }

    let sellOrders: SellOrder[] = [];
    let buyOrders: BuyOrder[] = [];
    let matches: BuyOrderMatch[] = [];
    let success: string = '';

    switch (req.body.action) {
      case 'list':
        switch (req.body.orderType) {
          case 'sellOrders':
            sellOrders = await marketListingsCache.sellOrders(req.body.listId ?? 'validActive');
            break;
          case 'buyOrders':
            buyOrders = await marketListingsCache.buyOrders(req.body.listId ?? 'validActive');
            break;
        }

        break;
      case 'delete':
        switch (req.body.orderType) {
          case 'sellOrders':
            await marketListingsCache.deleteSellOrder(req.body.listId ?? 'validActive', req.body.orderId ?? '');

            success = `deleted sell: ${req.body.orderId}`;
            break;
          case 'buyOrders':
            await marketListingsCache.deleteBuyOrder(req.body.listId ?? 'validActive', req.body.orderId ?? '');
            success = `deleted buy: ${req.body.orderId}`;
            break;
        }

        break;
      case 'move':
        break;
      case 'buy':
        await marketListingsCache.executeBuyOrder(req.body.listId ?? 'validActive', req.body.orderId ?? '');
        success = `buy: ${req.body.orderId}`;
        break;
      case 'match':
        matches = await marketOrders.marketMatches();
        break;
    }

    // set result
    const resp = { buyOrders: buyOrders, sellOrders: sellOrders, error: '', success: success, matches: matches };
    res.send(resp);
    return;
  } catch (err) {
    error('Failed', err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};

const badRequest = (req: Request<any, any, MarketListingsBody>, res: Response): boolean => {
  if (Object.keys(req.body).length === 0) {
    error('Invalid input - body empty');
    return true;
  }

  return false;
};

const router = Router();

router.post('/', post);

export default router;
