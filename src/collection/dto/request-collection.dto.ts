import { ChainId } from '@infinityxyz/lib/types/core';
import { ApiProperty } from '@nestjs/swagger';
import { IsEthereumAddress } from 'class-validator';
import { IsSupportedChainId } from 'common/decorators/IsSuppportedChainId';

export class RequestCollectionDto {
  @ApiProperty({
    description: 'Collection Address'
  })
  @IsEthereumAddress({
    message: 'Invalid address'
  })
  readonly address: string;

  @ApiProperty({
    description: 'Collection chain id',
    enum: ChainId
  })
  @IsSupportedChainId({
    message: 'Invalid chainId'
  })
  readonly chainId: ChainId;
}
