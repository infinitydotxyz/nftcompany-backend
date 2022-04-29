import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class ChainTokensDto {
  @ApiProperty({
    description: 'Token id of an Nft to include in the order'
  })
  @IsString()
  @IsNotEmpty()
  tokenId: string;

  @ApiProperty({
    description: 'Number of nfts: 1 for ERC721, >= 1 for ERC1155'
  })
  @IsNumber()
  numTokens: number;
}
