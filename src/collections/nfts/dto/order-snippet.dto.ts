import { OrdersSnippet } from '@infinityxyz/lib/types/core';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { OrderItemSnippetDto } from './order-item-snippet.dto';

export class OrdersSnippetDto implements OrdersSnippet {
  @ApiPropertyOptional({
    description: 'Listing for this nft'
  })
  @IsOptional()
  @ValidateNested({ message: 'Invalid listing' })
  @Type(() => OrderItemSnippetDto)
  listing?: OrderItemSnippetDto;

  @ApiPropertyOptional({
    description: 'Offer for this nft'
  })
  @IsOptional()
  @ValidateNested({ message: 'Invalid offer' })
  @Type(() => OrderItemSnippetDto)
  offer?: OrderItemSnippetDto;
}
