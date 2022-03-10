import { BuyOrder, MarketOrder, SellOrder, StatusCode } from '@infinityxyz/lib/types/core';
import { error, trimLowerCase } from '@infinityxyz/lib/utils';
import { Request, Response } from 'express';
import { marketOrders } from './marketOrders';

interface Body {
  buyOrder?: BuyOrder;
  sellOrder?: SellOrder;
}

interface Req {
  user?: string;
}

interface ResBody {
  error: string;
  result: MarketOrder[];
}

export const market = async (req: Request<Req, any, Body>, res: Response<ResBody>) => {
  try {
    if (badRequest(req, res)) {
      res.sendStatus(StatusCode.BadRequest);
      return;
    }

    const user = trimLowerCase(req.params.user);

    let result;

    if (req.body.buyOrder) {
      result = await marketOrders.buy(user, req.body.buyOrder);
    }

    if (req.body.sellOrder) {
      result = await marketOrders.sell(user, req.body.sellOrder);
    }

    // set result
    const resp = { result: result, error: '' };
    res.send(resp);
    return;
  } catch (err) {
    error('Failed', err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};

const badRequest = (req: Request<Req, any, Body>, res: Response): boolean => {
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
