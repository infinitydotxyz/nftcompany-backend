import { ChainId } from '@infinityxyz/lib/types/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEthereumAddress, IsOptional, IsString } from 'class-validator';
import { IsSupportedChainId } from 'common/decorators/IsSupportedChainId';
import { normalizeAddressTransformer } from 'common/transformers/normalize-address.transformer';

export class AssetQueryDto {
  @ApiPropertyOptional({
    description: 'Collection Slug'
  })
  @IsString({
    message: 'Invalid slug'
  })
  @IsOptional()
  readonly slug?: string;

  @ApiPropertyOptional({
    description: 'Collection Address'
  })
  @IsEthereumAddress({
    message: 'Invalid address'
  })
  @Transform(normalizeAddressTransformer)
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

  @ApiProperty({
    description: 'Token id of the asset to get'
  })
  @IsString()
  tokenId: string;
}
