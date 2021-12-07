import { NextFunction, Request, Response } from 'express';

export function getRequestLogPrefix(req: Request) {
  const date = new Date();
  const path = req.path;
  const ip = req.ip;
  const method = req.method;
  return `[${date.toISOString()}]:[${method}]:[${path}]:[${ip}]`;
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  console.log(getRequestLogPrefix(req));
  next();
}
