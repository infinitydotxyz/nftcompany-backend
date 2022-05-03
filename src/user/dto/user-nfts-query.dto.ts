import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsString, IsOptional, IsEthereumAddress, IsArray, ArrayMaxSize } from 'class-validator';
import { normalizeAddressArrayTransformer } from 'common/transformers/normalize-address.transformer';
import { parseIntTransformer } from 'common/transformers/parse-int.transformer';

const MAX_COLLECTION_ADDRESSES = 20;

export class UserNftsQueryDto {
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
