import { ChainId } from '@infinityxyz/lib/types/core';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsSupportedChainId } from 'common/decorators/IsSuppportedChainId';

export class RequestCollectionBySlugDto {
  @ApiProperty({
    description: 'Collection Slug'
  })
  @IsString({
    message: 'Invalid slug'
  })
  readonly slug: string;

  @ApiProperty({
    description: 'Collection chain id',
    enum: ChainId
  })
  @IsSupportedChainId({
    message: 'Invalid chainId'
  })
  readonly chainId: ChainId;
}
