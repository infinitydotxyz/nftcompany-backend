import { trimLowerCase } from '@infinityxyz/lib/utils';
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { SUPPORTED_CHAIN_IDS } from '../../constants';

@Injectable()
export class ParseChainIdPipe<T extends { chainId: string }> implements PipeTransform<T, T> {
  transform(value: T): T {
    const chainId = trimLowerCase(value.chainId);
    const numberChainId = parseInt(chainId, 10);
    const isNumber = !Number.isNaN(numberChainId);

    if (!isNumber) {
      throw new BadRequestException(`Invalid chainId: ${chainId}`);
    }

    if (!SUPPORTED_CHAIN_IDS[chainId]) {
      throw new BadRequestException(`Unsupported chainId: ${chainId}`);
    }

    return {
      ...value,
      chainId: chainId
    };
  }
}
