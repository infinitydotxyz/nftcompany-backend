import { normalizeAddress } from '@infinityxyz/lib/utils';
import { TransformFnParams } from 'class-transformer';
import { arrayTransformer } from './array-query.transformer';

export function normalizeAddressTransformer(params: TransformFnParams): string {
  const address = params.value;
  const normalized = normalizeAddress(address);
  return normalized;
}

export function normalizeAddressArrayTransformer(params: TransformFnParams): string[] {
  const addresses = arrayTransformer<string>(params);
  const normalized = addresses.map((address: string) => normalizeAddress(address));
  return normalized;
}
