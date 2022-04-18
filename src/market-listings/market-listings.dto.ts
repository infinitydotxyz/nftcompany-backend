import { MarketAction, MarketListId, MarketOrder } from '@infinityxyz/lib/types/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { parseIntTransformer } from 'common/transformers/parse-int.transformer';

// This should match MarketListingsBody in lib

export class MarketListingsBodyDto {
  @ApiProperty({
    description: 'Market order type',
    enum: MarketOrder
  })
  @IsEnum(MarketOrder)
  orderType!: MarketOrder;

  @ApiProperty({
    description: 'Market action',
    enum: MarketAction
  })
  @IsEnum(MarketAction)
  action!: MarketAction;

  @ApiPropertyOptional({
    description: 'Market list id',
    enum: MarketListId
  })
  @IsEnum(MarketListId)
  @IsOptional()
  listId?: MarketListId;

  @ApiPropertyOptional({
    description: 'Market order id'
  })
  @IsOptional()
  @IsString()
  orderId?: string; // Delete and move

  @ApiPropertyOptional({
    description: 'Move list id',
    enum: MarketListId
  })
  @IsEnum(MarketListId)
  @IsOptional()
  moveListId?: MarketListId;

  @ApiPropertyOptional({
    description: 'Cursor to start after'
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Limit the number of results. (max 50)'
  })
  @IsOptional()
  @IsNumber()
  @Transform(parseIntTransformer({ max: 50, optional: true }))
  limit?: number;
}
