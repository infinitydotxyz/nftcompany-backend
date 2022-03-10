import { StatusCode } from '@infinityxyz/lib/types/core';
import { Request, Response, Router } from 'express';
import { error } from '@infinityxyz/lib/utils';

interface Body {
  listId: 'listings' | 'orders';
  action: 'add' | 'delete' | 'move';
  subListId?: 'validActive' | 'validInactive' | 'invalid';
  moveListId?: 'validActive' | 'validInactive' | 'invalid';
}

interface ResBody {
  result: string[];
  error: string;
}

const post = async (req: Request<any, any, Body>, res: Response<ResBody>) => {
  try {
    if (badRequest(req, res)) {
      res.sendStatus(StatusCode.BadRequest);
      return;
    }

    const result: string[] = [];

    switch (req.body.subListId) {
      case 'validActive':
        result.push(req.body.subListId);
        break;
      case 'validInactive':
        result.push(req.body.subListId);
        break;
      case 'invalid':
        result.push(req.body.subListId);
        break;
    }

    switch (req.body.listId) {
      case 'listings':
        result.push(req.body.listId);
        break;
      case 'orders':
        result.push(req.body.listId);
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

// buyOrders: BuyOrder[] = [];
// sellOrders: SellOrder[] = [];
