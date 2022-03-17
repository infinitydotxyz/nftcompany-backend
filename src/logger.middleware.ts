import { log } from '@infinityxyz/lib/utils';
import { Request, Response, NextFunction } from 'express';

export function toLog(req: Request) {
  return `[${new Date().toISOString()}]: [${req.method}]: [${req.path}]: [${req.ip}]`;
}

/**
 * Global logging middleware that logs any incoming request.
 */
export function logger(req: Request, res: Response, next: NextFunction) {
  const line = toLog(req);
  log(line);
  next();
}
