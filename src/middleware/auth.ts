import { ethers } from 'ethers';
import { NextFunction, Response, Request } from 'express';
import { auth } from '@constants';
import { error } from '../utils/logger.js';

export async function authorizeUser(req: Request, res: Response, next: NextFunction) {
  // todo: adi for testing only
  // return true;

  // path is in the form /u/user/*
  const userId = req.path.split('/')[2].trim().toLowerCase();
  const signature = req.header(auth.signature);
  const message = req.header(auth.message);
  try {
    // verify signature
    const sign = JSON.parse(signature);
    const actualAddress = ethers.utils.verifyMessage(message, sign).toLowerCase();
    if (actualAddress === userId) {
      return true;
    }
  } catch (err) {
    error('Cannot authorize user ' + userId);
    error(err);
  }
  return false;
}
