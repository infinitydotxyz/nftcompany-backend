import { NextFunction, Request, Response } from 'express';
import { getRequestLogPrefix, error, log } from './logger.js';

/**
 * express middleware error handler
 *
 * must have all 4 argements listed so express can
 * identify it as an error handler
 *
 */
export function requestErrorHandler(err: Error, req: Request, res: Response, _: NextFunction) {
  const prefix = getRequestLogPrefix(req);
  const internalServerError = 500;
  log(`${prefix} Status Code: ${internalServerError}`);
  error(err);
  res.sendStatus(internalServerError);
}
