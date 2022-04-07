import { OrderDirection } from '@infinityxyz/lib/types/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { arrayTransformer } from 'common/transformers/array-query.transformer';
import { parseIntTransformer } from 'common/transformers/parse-int.transformer';

export enum NftsOrderBy {
  RarityRank = 'rarityRank',
  TokenId = 'tokenId'
}

export class NftsQueryDto {
  @ApiProperty({
    description: 'Property to order nfts by',
    enum: NftsOrderBy
  })
  @IsEnum(NftsOrderBy)
  orderBy: NftsOrderBy;

  @ApiProperty({
    description: 'Direction to order by',
    enum: OrderDirection
  })
  @IsEnum(OrderDirection)
  orderDirection: OrderDirection;

  @ApiProperty({
    description: 'Number of results to get. Max of 50'
  })
  @IsNumber()
  @Transform(parseIntTransformer({ max: 50 }))
  limit: number;

  @ApiPropertyOptional({
    description: 'Cursor to start after'
  })
  @IsString()
  @IsOptional()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Trait types to filter by',
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @Transform(arrayTransformer)
  traitType?: string[];

  @ApiPropertyOptional({
    description: 'Trait values to filter by, supply multiple values for a single trait by separating with a |',
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @Transform(arrayTransformer)
  traitValue?: string[];
}
