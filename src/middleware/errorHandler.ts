import { StatusCode } from '@infinityxyz/types/core';
import { NextFunction, Request, Response } from 'express';
import { error, log } from '../utils/logger';
import { getRequestLogPrefix } from './logger';

/**
 * express middleware error handler
 *
 * must have all 4 argements listed so express can
 * identify it as an error handler
 *
 */
export function requestErrorHandler(err: Error, req: Request, res: Response, _: NextFunction) {
  const prefix = getRequestLogPrefix(req);
  const status = StatusCode.InternalServerError;
  log(`${prefix} Status Code: ${status}`);
  error(err);
  res.sendStatus(status);
}
