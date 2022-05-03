import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsString, IsOptional, IsEthereumAddress } from 'class-validator';
import { normalizeAddressTransformer } from 'common/transformers/normalize-address.transformer';
import { parseIntTransformer } from 'common/transformers/parse-int.transformer';

export class UserNftsQueryDto {
  @ApiPropertyOptional({
    description: 'Collection address to filter by'
  })
  @IsOptional()
  @Transform(normalizeAddressTransformer)
  @IsEthereumAddress()
  collectionAddress?: string;

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
