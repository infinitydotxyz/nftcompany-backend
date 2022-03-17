import { trimLowerCase } from '@infinityxyz/lib/utils';
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ethers } from 'ethers';

@Injectable()
export class ParseAddressPipe<T extends { address: string }> implements PipeTransform<T, T> {
  transform(value: T): T {
    const normalizedAddress = trimLowerCase(value.address);
    if (!ethers.utils.isAddress(normalizedAddress)) {
      throw new BadRequestException('Invalid ethereum address');
    }

    return {
      ...value,
      address: normalizedAddress
    };
  }
}
