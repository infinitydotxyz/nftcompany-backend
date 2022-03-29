import { ChainId } from '@infinityxyz/lib/types/core';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, IsOptional, IsEthereumAddress, IsArray, IsEnum } from 'class-validator';
import { IsSupportedChainId } from 'common/decorators/is-supported-chain-id';
import { normalizeAddressTransformer } from 'common/transformers/normalize-address.transformer';

enum ActivityType {
  Transfer = 'transfer',
  Sale = 'sale',
  Offer = 'offer'
}

export class NftActivityQuery {
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
    description: 'Token id of the nft to get'
  })
  @IsString()
  tokenId: string;

  @ApiProperty({
    description: 'Activity types to include in the response'
  })
  @IsArray()
  @IsEnum(ActivityType, { each: true })
  eventTypes: ActivityType[];
}
