import { GetOrderItemsQuery, OBOrderStatus, OrderDirection } from '@infinityxyz/lib/types/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsEthereumAddress, IsNumber, IsOptional, IsString } from 'class-validator';
import {
  normalizeAddressArrayTransformer,
  normalizeAddressTransformer
} from 'common/transformers/normalize-address.transformer';
import { parseBoolTransformer } from 'common/transformers/parse-bool.transformer';
import { parseIntTransformer } from 'common/transformers/parse-int.transformer';
import { roundNumberTransformer } from 'common/transformers/round-number.transformer';

export enum OrderItemsOrderBy {
  Price = 'startPriceEth',
  StartTime = 'startTimeMs',
  EndTime = 'endTimeMs'
}

export class OrderItemsQueryDto implements Omit<GetOrderItemsQuery, 'chainId'> {
  //   @ApiPropertyOptional({
  //     description: 'The chain id to filter orders by'
  //   })
  //   @IsSupportedChainId()
  //   chainId?: ChainId;

  @ApiPropertyOptional({
    description: 'Filter by order type'
  })
  @IsOptional()
  @Transform(parseBoolTransformer({ optional: true }))
  @IsBoolean()
  isSellOrder?: boolean;

  @ApiPropertyOptional({
    description: 'Maker address to filter orders by'
  })
  @IsOptional()
  @Transform(normalizeAddressTransformer)
  @IsEthereumAddress()
  makerAddress?: string;

  @ApiPropertyOptional({
    description: 'Taker address to filter orders by'
  })
  @IsOptional()
  @Transform(normalizeAddressTransformer)
  @IsEthereumAddress()
  takerAddress?: string;

  @ApiPropertyOptional({
    description: 'Order status to filter by',
    enum: OBOrderStatus
  })
  @IsOptional()
  @IsEnum(OBOrderStatus)
  orderStatus?: OBOrderStatus;

  @ApiPropertyOptional({
    description: 'Min price to filter by'
  })
  @IsOptional()
  @IsNumber({
    maxDecimalPlaces: 18
  })
  @Transform(roundNumberTransformer(18))
  minPrice?: number;

  @ApiPropertyOptional({
    description: 'Max price to filter by'
  })
  @IsOptional()
  @IsNumber({
    maxDecimalPlaces: 18
  })
  @Transform(roundNumberTransformer(18))
  maxPrice?: number;

  @ApiPropertyOptional({
    description: 'Order quantity to filter by'
  })
  @IsOptional()
  @IsNumber()
  numItems?: number;

  @ApiPropertyOptional({
    description: 'Collection addresses to filter by',
    type: [String]
  })
  @IsOptional()
  @Transform(normalizeAddressArrayTransformer)
  @IsArray()
  @IsEthereumAddress({ each: true })
  collections?: string[];

  @ApiPropertyOptional({
    description: 'Cursor to start after'
  })
  @IsString()
  @IsOptional()
  cursor?: string;

  @ApiProperty({
    description: 'Number of results to get. Max of 50'
  })
  @IsNumber()
  @Transform(parseIntTransformer({ max: 50 }))
  limit: number;

  @ApiPropertyOptional({
    description: 'Parameter to order results by',
    enum: OrderItemsOrderBy
  })
  @IsOptional()
  @IsEnum(OrderItemsOrderBy)
  orderBy?: OrderItemsOrderBy;

  @ApiPropertyOptional({
    description: 'Direction to order results by',
    enum: OrderDirection
  })
  @IsOptional()
  @IsEnum(OrderDirection)
  orderByDirection?: OrderDirection;
}
