import { ChainId } from '@infinityxyz/lib/types/core';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEthereumAddress, IsOptional, IsString } from 'class-validator';
import { IsSupportedChainId } from 'common/decorators/is-supported-chain-id';
import { normalizeAddressTransformer } from 'common/transformers/normalize-address.transformer';
import { CollectionViaAddressDto, CollectionViaSlugDto } from 'firebase/dto/collection-ref.dto';

export class CollectionQueryDto implements Partial<CollectionViaAddressDto>, Partial<CollectionViaSlugDto> {
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

  @ApiPropertyOptional({
    description: 'Collection chain id',
    enum: ChainId
  })
  @IsSupportedChainId({
    message: 'Invalid chainId'
  })
  readonly chainId?: ChainId;
}
