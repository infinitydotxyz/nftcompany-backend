import { TransformFnParams } from 'class-transformer';

/**
 * Transform what may be a single value or an array of values into an array of values
 *
 * Mainly used for parsing arrays of values from a query string where a single value
 * fails to get parsed as an array
 */
export function arrayTransformer<T>(params: TransformFnParams): T[] {
  const value = Array.isArray(params.value) ? params.value : [params.value];
  return value;
}
