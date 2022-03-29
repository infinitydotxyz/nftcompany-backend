import { ChainId, StatsPeriod } from '@infinityxyz/lib/types/core';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, IsOptional, IsEthereumAddress, IsEnum } from 'class-validator';
import { CollectionQueryDto } from 'collection/dto/collection-query.dto';
import { IsSupportedChainId } from 'common/decorators/IsSupportedChainId';
import { normalizeAddressTransformer } from 'common/transformers/normalize-address.transformer';

export class CollectionStatsQueryDto implements CollectionQueryDto {
  @ApiPropertyOptional({
    description: 'Date to get stats for'
  })
  date?: number;

  @ApiProperty({
    description: 'The period to get stats for'
  })
  @IsEnum(StatsPeriod)
  period: StatsPeriod;

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
}
