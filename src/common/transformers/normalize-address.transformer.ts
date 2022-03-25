import { normalizeAddress } from '@infinityxyz/lib/utils';
import { TransformFnParams } from 'class-transformer';

export function normalizeAddressTransformer(): (params: TransformFnParams) => string {
  return (params: TransformFnParams) => {
    const address = params.value;
    const normalized = normalizeAddress(address);
    return normalized;
  };
}
