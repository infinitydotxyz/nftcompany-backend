import { OrderDirection } from '@infinityxyz/lib/types/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsString, IsOptional, IsEnum } from 'class-validator';
import { parseIntTransformer } from 'common/transformers/parse-int.transformer';

export class UserCollectionVotesQuery {
  @ApiPropertyOptional({
    description:
      'Direction to order votes by. Defaults to `desc`. Votes are ordered by the date they were cast. `desc` returns the most recent votes first'
  })
  @IsEnum(OrderDirection)
  @IsOptional()
  orderDirection?: OrderDirection;

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
}
