import { MarketOrder, StatusCode } from '@infinityxyz/lib/types/core';
import { Request, Response, Router } from 'express';
import { error } from '@infinityxyz/lib/utils';
import { marketListingsCache } from './marketListingsCache';

export type OrderType = 'sellOrders' | 'buyOrders';
export type ActionType = 'list' | 'add' | 'delete' | 'move';
export type ListIdType = 'validActive' | 'validInactive' | 'invalid';

interface Body {
  orderType: OrderType;
  action: ActionType;
  listId?: ListIdType;
  moveListId?: ListIdType;
}

interface ResBody {
  result: MarketOrder[];
  error: string;
}

const post = async (req: Request<any, any, Body>, res: Response<ResBody>) => {
  try {
    if (badRequest(req, res)) {
      res.sendStatus(StatusCode.BadRequest);
      return;
    }

    let result;

    switch (req.body.orderType) {
      case 'sellOrders':
        switch (req.body.listId) {
          case 'validActive':
          case 'validInactive':
          case 'invalid':
            result = await marketListingsCache.sellOrders(req.body.listId);

            break;
        }

        break;
      case 'buyOrders':
        switch (req.body.listId) {
          case 'validActive':
          case 'validInactive':
          case 'invalid':
            result = await marketListingsCache.buyOrders(req.body.listId);

            break;
        }

        break;
    }

    // chainId::collectionAddress::tokenId
    // getDocIdHash

    // set result
    const resp = { result: result, error: '' };
    res.send(resp);
    return;
  } catch (err) {
    error('Failed', err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};

const badRequest = (req: Request<any, any, Body>, res: Response): boolean => {
  if (Object.keys(req.body).length === 0) {
    error('Invalid input - body empty');
    return true;
  }

  return false;
};

const router = Router();

router.post('/', post);

export default router;
