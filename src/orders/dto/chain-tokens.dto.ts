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
    description: 'The quantity of the Nft'
  })
  @IsNumber()
  numTokens: number;
}
