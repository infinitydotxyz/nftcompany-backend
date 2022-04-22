import { trimLowerCase } from '@infinityxyz/lib/utils';
import { PipeTransform, Injectable } from '@nestjs/common';

@Injectable()
export class NormalizeAddressPipe<T extends { address: string } | string> implements PipeTransform<T, T> {
  transform(value: T): T {
    if (typeof value === 'string') {
      return trimLowerCase(value) as T;
    }
    const normalizedAddress = trimLowerCase(value?.address);
    return {
      ...(value as any),
      address: normalizedAddress
    } as T;
  }
}
