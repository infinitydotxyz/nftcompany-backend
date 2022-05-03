import { TransformFnParams } from 'class-transformer';
import { round } from 'lodash';

export function roundNumberTransformer(precision: number) {
  return (params: TransformFnParams): number | undefined => {
    const value = parseFloat(params.value);
    if (!Number.isNaN(value)) {
      return round(value, precision);
    }
    return undefined;
  };
}
