import { StatusCode, OBOrder, BuyOrderMatch, MarketListingsBody } from '@infinityxyz/lib/types/core';
import { error } from '@infinityxyz/lib/utils';
import { Controller, Post, Req, Res } from '@nestjs/common';
import { sellOrders, buyOrders, deleteSellOrder, deleteBuyOrder } from 'routes/marketListings/marketFirebase';
import { marketOrders } from 'routes/marketListings/marketOrders';
import { Request } from 'express';

@Controller('marketListings') // TODO should not be camelcase
export class MarketListingsController {
  @Post()
  async market(@Req() req, @Res() res) {
    try {
      if (badRequest(req)) {
        res.sendStatus(StatusCode.BadRequest);
        return;
      }

      let sellOrds: OBOrder[] = [];
      let buyOrds: OBOrder[] = [];
      let matches: BuyOrderMatch[] = [];
      let success = '';

      switch (req.body.action) {
        case 'list':
          switch (req.body.orderType) {
            case 'sellOrders':
              sellOrds = await sellOrders(req.body.listId ?? 'validActive');
              break;
            case 'buyOrders':
              buyOrds = await buyOrders(req.body.listId ?? 'validActive');
              break;
          }

          break;
        case 'delete':
          switch (req.body.orderType) {
            case 'sellOrders':
              await deleteSellOrder(req.body.listId ?? 'validActive', req.body.orderId ?? '');

              success = `deleted sell: ${req.body.orderId}`;
              break;
            case 'buyOrders':
              await deleteBuyOrder(req.body.listId ?? 'validActive', req.body.orderId ?? '');
              success = `deleted buy: ${req.body.orderId}`;
              break;
          }

          break;
        case 'move':
          break;
        case 'buy':
          await marketOrders.executeBuyOrder(req.body.orderId ?? '');
          success = `buy: ${req.body.orderId}`;
          break;
        case 'match':
          matches = await marketOrders.marketMatches();
          break;
      }

      // Set result
      const resp = { buyOrders: buyOrds, sellOrders: sellOrds, error: '', success: success, matches: matches };
      res.send(resp);
      return;
    } catch (err) {
      error('Failed', err);
      res.sendStatus(StatusCode.InternalServerError);
    }
  }
}

const badRequest = (req: Request<any, any, MarketListingsBody>): boolean => {
  if (Object.keys(req.body).length === 0) {
    error('Invalid input - body empty');
    return true;
  }

  return false;
};
