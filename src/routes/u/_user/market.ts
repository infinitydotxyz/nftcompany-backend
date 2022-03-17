import { BuyOrderMatch, StatusCode, TradeBody, TradeReq, TradeResponse } from '@infinityxyz/lib/types/core';
import { error, trimLowerCase } from '@infinityxyz/lib/utils';
import { Request, Response } from 'express';
import { marketOrders } from '../../marketListings/marketOrders';

export const market = async (req: Request<TradeReq, any, TradeBody>, res: Response<TradeResponse>) => {
  try {
    if (badRequest(req, res)) {
      res.sendStatus(StatusCode.BadRequest);
      return;
    }

    // user is in the order, but we could check if they match?
    // const user = trimLowerCase(req.params.user);

    let matches: BuyOrderMatch[] = [];

    if (req.body.buyOrder) {
      matches = await marketOrders.buy(req.body.buyOrder, 'validActive');
    } else if (req.body.sellOrder) {
      matches = await marketOrders.sell(req.body.sellOrder, 'validActive');
    }

    // set result
    const resp = { matches: matches, error: '', success: 'OK' };
    res.send(resp);
    return;
  } catch (err) {
    error('Failed', err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const badRequest = (req: Request<TradeReq, any, TradeBody>, _res: Response<TradeResponse>): boolean => {
  if (Object.keys(req.body).length === 0) {
    error('Invalid input - body empty');
    return true;
  }

  const user = trimLowerCase(req.params.user);
  if (!user) {
    error('Invalid input - no user');
    return true;
  }

  return false;
};
