import { OrderDirection } from '@infinityxyz/lib/types/core';
import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { arrayTransformer } from 'common/transformers/array-query.transformer';
import { parseIntTransformer } from 'common/transformers/parse-int.transformer';
import { PriceFilterDto } from './price-filter.dto';

export enum NftsOrderBy {
  RarityRank = 'rarityRank',
  TokenId = 'tokenId'
}

export class NftsQueryDto extends PickType(PriceFilterDto, ['minPrice', 'maxPrice', 'currency'] as const) {
  @ApiProperty({
    description: 'Property to order nfts by',
    enum: NftsOrderBy
  })
  @IsEnum(NftsOrderBy)
  orderBy!: NftsOrderBy;

  @ApiProperty({
    description: 'Direction to order by',
    enum: OrderDirection
  })
  @IsEnum(OrderDirection)
  orderDirection!: OrderDirection;

  @ApiProperty({
    description: 'Number of results to get. Max of 50'
  })
  @IsNumber()
  @Transform(parseIntTransformer({ max: 50 }))
  limit!: number;

  @ApiPropertyOptional({
    description: 'Cursor to start after'
  })
  @IsString()
  @IsOptional()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Trait types to filter by. Use commas for multiple types.',
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @Transform(arrayTransformer)
  traitTypes?: string[];

  @ApiPropertyOptional({
    description:
      'Trait values to filter by. Use commas for multiple values. Supply multiple values for a single trait by separating with a |',
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @Transform(arrayTransformer)
  traitValues?: string[];
}
