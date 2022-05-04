import { OrderDirection } from '@infinityxyz/lib/types/core';
import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsString, IsOptional, IsEthereumAddress, IsArray, ArrayMaxSize, IsEnum } from 'class-validator';
import { PriceFilterDto } from 'collections/nfts/dto/price-filter.dto';
import { normalizeAddressArrayTransformer } from 'common/transformers/normalize-address.transformer';
import { parseIntTransformer } from 'common/transformers/parse-int.transformer';

const MAX_COLLECTION_ADDRESSES = 20;

export enum UserNftsOrderType {
  Listings = 'listings',
  OffersMade = 'offersMade',
  OffersReceived = 'offersReceived'
}

export enum UserNftsOrderBy {
  Price = 'price'
}

export class UserNftsQueryDto extends PickType(PriceFilterDto, ['minPrice', 'maxPrice', 'currency']) {
  @ApiPropertyOptional({
    description: 'Collection address to filter by',
    type: [String]
  })
  @IsOptional()
  @Transform(normalizeAddressArrayTransformer)
  @IsArray()
  @IsEthereumAddress({ each: true })
  @ArrayMaxSize(MAX_COLLECTION_ADDRESSES, { message: `Can filter by a max of ${MAX_COLLECTION_ADDRESSES} addresses` })
  collectionAddresses?: string[];

  @ApiPropertyOptional({
    description: 'Order type to filter by',
    enum: UserNftsOrderType
  })
  @IsOptional()
  @IsEnum(UserNftsOrderType)
  orderType?: UserNftsOrderType;

  @ApiPropertyOptional({
    description: 'Property to order by. Requires order type to be defined'
  })
  @IsOptional()
  @IsEnum(UserNftsOrderBy)
  orderBy?: UserNftsOrderBy;

  @ApiPropertyOptional({
    description: 'Order direction',
    enum: OrderDirection
  })
  @IsOptional()
  @IsEnum(OrderDirection)
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
