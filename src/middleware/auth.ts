import { ethers } from 'ethers';
import { NextFunction, Response, Request } from 'express';
import { auth } from '@constants';
import { error } from '../utils/logger.js';
import { StatusCode } from '@base/types/StatusCode.js';

export async function authorizeUser(req: Request<{ user: string }>, res: Response, next: NextFunction) {
  // todo: adi for testing only
  // return true;

  const userId = req.params.user.trim().toLowerCase();
  const signature = req.header(auth.signature);
  const message = req.header(auth.message);
  if (!signature || !message) {
    res.sendStatus(StatusCode.Unauthorized);
    return;
  }
  try {
    // verify signature
    const sign = JSON.parse(signature);
    const actualAddress = ethers.utils.verifyMessage(message, sign).toLowerCase();
    if (actualAddress === userId) {
      next();
      return;
    }
  } catch (err) {
    error('Cannot authorize user ' + userId);
    error(err);
  }
  res.sendStatus(StatusCode.Unauthorized);
}
