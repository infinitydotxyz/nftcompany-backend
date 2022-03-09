import { StatusCode } from '@infinityxyz/lib/types/core';
import { error } from 'utils/logger';
import { Router, Request, Response } from 'express';
import { marketOrders } from './marketOrders';
import { postUserRateLimit } from 'middleware/rateLimit';
import { jsonString, trimLowerCase } from '@infinityxyz/lib/utils';

interface Body {
  txnHash: string;
}

interface Req {
  user?: string;
}

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

  if (!req.body.txnHash || !req.body.txnHash.trim()) {
    error('Invalid input - no txn hash');
    return true;
  }

  return false;
};

const post = async (req: Request<Req, any, Body>, res: Response) => {
  try {
    if (badRequest(req, res)) {
      res.sendStatus(StatusCode.BadRequest);
    }

    //   const startsWithOrig = req.query.startsWith;
    marketOrders.duh();

    // set result
    const resp = { result: 'OK' };
    const respStr = jsonString(resp);
    res.set({
      'Cache-Control': 'must-revalidate, max-age=60',
      'Content-Length': Buffer.byteLength(respStr ?? '', 'utf8')
    });

    res.send(respStr);
    return;
  } catch (err) {
    error('Failed to get titles', err);
    res.sendStatus(StatusCode.InternalServerError);
  }
};

// export router
const router = Router();
router.post('/', postUserRateLimit, post);

export default router;
