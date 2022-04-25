import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEthereumAddress, IsNotEmpty, IsString } from 'class-validator';

export class ChainNFTsDto {
  @ApiProperty({
    description: 'Collection address'
  })
  @IsString()
  @IsNotEmpty()
  @IsEthereumAddress()
  collection: string;

  @ApiProperty({
    description: 'Tokens in the order'
  })
  @IsArray()
  tokens: { tokenId: string; numTokens: number }[];
}
