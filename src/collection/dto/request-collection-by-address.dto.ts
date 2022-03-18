import { ChainId } from '@infinityxyz/lib/types/core';
import { ApiProperty } from '@nestjs/swagger';
import { IsEthereumAddress, IsOptional, IsString } from 'class-validator';
import { IsSupportedChainId } from 'common/decorators/IsSuppportedChainId';

export class RequestCollectionByAddressDto {
  @ApiProperty({
    description: 'Collection Slug',
    required: false
  })
  @IsString({
    message: 'Invalid slug'
  })
  @IsOptional()
  readonly slug?: string;

  @ApiProperty({
    description: 'Collection Address',
    required: false
  })
  @IsEthereumAddress({
    message: 'Invalid address'
  })
  @IsOptional()
  readonly address?: string;

  @ApiProperty({
    description: 'Collection chain id',
    enum: ChainId
  })
  @IsSupportedChainId({
    message: 'Invalid chainId'
  })
  readonly chainId: ChainId;
}
