import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsEthereumAddress, ValidateNested } from 'class-validator';
import { normalizeAddressTransformer } from 'common/transformers/normalize-address.transformer';
import { ChainTokensDto } from './chain-tokens.dto';

export class ChainNFTsDto {
  @ApiProperty({
    description: 'Collection address'
  })
  @IsEthereumAddress()
  @Transform(normalizeAddressTransformer)
  collection: string;

  @ApiProperty({
    description: 'Tokens in the order',
    type: [ChainTokensDto]
  })
  @IsArray({ each: true })
  @ValidateNested()
  @Type(() => ChainTokensDto)
  tokens: ChainTokensDto[];
}
