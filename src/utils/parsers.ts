import { StatusCode } from '@infinityxyz/lib/types/core';
import { Request, Response } from 'express';
import { error } from '@infinityxyz/lib/utils';

// Get and parseFloat (also validate float) req.query fields, return a map of { fieldName: numberValue,... }
export function parseQueryFields<K extends string>(
  res: Response,
  req: Request,
  fieldArr: K[],
  defaultValues: string[]
): { [P in K]: number } | { error: string } {
  const numberFields: { [P in K]: number } = {} as any;
  try {
    fieldArr.forEach((name, idx) => {
      const q = req.query?.[name] as string;
      numberFields[name] = parseFloat(q?.length > 0 ? q : defaultValues[idx]);
      if (isNaN(numberFields[name])) {
        throw Error(`Invalid query param: ${name} = ${q}`);
      }
    });
  } catch (err: any) {
    error('Invalid query params: ' + fieldArr.join(', '));
    error(err);
    res.sendStatus(StatusCode.BadRequest);
    return { error: err };
  }
  return numberFields;
}
