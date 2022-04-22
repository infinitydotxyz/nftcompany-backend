import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEthereumAddress, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { BigNumberish, BytesLike } from 'ethers';
import { ChainNFTsDto } from './chain-nfts.dto';

export class ChainOBOrderDto {
  @ApiProperty({
    description: 'Order side (buy/sell)'
  })
  @IsBoolean()
  isSellOrder: boolean;

  @ApiProperty({
    description: 'Signer address'
  })
  @IsString()
  @IsNotEmpty()
  @IsEthereumAddress()
  signer: string;

  @ApiProperty({
    description: 'Constraints like num items, prices, times'
  })
  @IsArray()
  constraints: BigNumberish[];

  @ApiProperty({
    description: 'NFTs in the order'
  })
  @ValidateNested({ each: true })
  @Type(() => ChainNFTsDto)
  @IsArray()
  nfts: ChainNFTsDto[];

  @ApiProperty({
    description: 'Exec params like currency address, complication address'
  })
  @IsArray()
  execParams: string[];

  @ApiProperty({
    description: 'Encoded extra params'
  })
  extraParams: BytesLike;

  @ApiProperty({
    description: 'Order signature'
  })
  @IsNotEmpty()
  sig: BytesLike;
}
