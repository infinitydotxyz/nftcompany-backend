import { ChainId } from '@infinityxyz/lib/types/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEthereumAddress, IsOptional, IsString } from 'class-validator';
import { IsSupportedChainId } from 'common/decorators/IsSuppportedChainId';

export class CollectionRefViaSlugDto {
  @ApiPropertyOptional({
    description: 'Collection Slug'
  })
  @IsString({
    message: 'Invalid slug'
  })
  @IsOptional()
  readonly slug?: string;
}

export class CollectionRefViaAddressDto {
  @ApiPropertyOptional({
    description: 'Collection Address'
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

export type CollectionRefDto = CollectionRefViaAddressDto | CollectionRefViaSlugDto;
