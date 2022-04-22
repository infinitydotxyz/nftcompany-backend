import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class OBTokenInfoDto {
  @ApiProperty({
    description: 'Token Id'
  })
  @IsString()
  @IsNotEmpty()
  tokenId: string;

  @ApiProperty({
    description: 'Token name'
  })
  @IsString()
  tokenName: string;

  @ApiProperty({
    description: 'Image url'
  })
  @IsString()
  @IsNotEmpty()
  tokenImage: string;

  @ApiProperty({
    description: 'No. of tokens. 1 for ERC721, >=1 for ERC1155'
  })
  @IsNumber()
  @IsNotEmpty()
  numTokens: number;

  @ApiProperty({
    description: 'Taker username'
  })
  @IsString()
  takerUsername: string;

  @ApiProperty({
    description: 'Taker address'
  })
  @IsString()
  takerAddress: string;
}
