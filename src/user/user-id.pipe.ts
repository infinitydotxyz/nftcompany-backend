import { ChainId } from '@infinityxyz/lib/types/core';
import { trimLowerCase } from '@infinityxyz/lib/utils';
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ethers } from 'ethers';
import { UserDto } from './dto/user.dto';

@Injectable()
export class ParseUserIdPipe implements PipeTransform<string, UserDto> {
  transform(value: string): UserDto {
    const [chainId, address] = value.split(':').map((item) => trimLowerCase(item));

    if (!Object.values(ChainId).includes(chainId as any)) {
      throw new BadRequestException('Invalid chain id');
    }

    if (!ethers.utils.isAddress(address)) {
      throw new BadRequestException('Invalid address');
    }

    return {
      userAddress: address
    };
  }
}
