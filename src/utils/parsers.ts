import { StatusCode } from '@base/types/StatusCode';
import { Request, Response } from 'express';
import { error } from './logger.js';

// get and parseFloat (also validate float) req.query fields, return a map of { fieldName: numberValue,... }
export function parseQueryFields(res: Response, req: Request, fieldArr: string[], defaultValues: string[]) {
  const numberFields: Record<string, number> = {};
  try {
    fieldArr.forEach((name, idx) => {
      numberFields[name] = parseFloat((req.query[name] as string) || defaultValues[idx]);
      if (isNaN(numberFields[name])) {
        throw Error(`Invalid query param: ${name} = ${req.query[name]}`);
      }
    });
  } catch (err) {
    error('Invalid query params: ' + fieldArr.join(', '));
    error(err);
    res.sendStatus(StatusCode.BadRequest);
    return { error: err };
  }
  return numberFields;
}
