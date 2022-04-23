import { ApiProperty } from '@nestjs/swagger';
import { IsEthereumAddress, IsNumber } from 'class-validator';

export class TopOwnerDto {
  @ApiProperty({
    description: 'The address of the owner'
  })
  @IsEthereumAddress()
  ownerAddress: string;

  @ApiProperty({
    description: 'The number of nfts owned in the collection by this owner'
  })
  @IsNumber()
  ownedCount: number;

  @ApiProperty({
    description: 'The percent of nfts owned by this owner in the collection'
  })
  @IsNumber()
  percentOwned: number;

  @ApiProperty({
    description: 'The number of nfts in the collection'
  })
  @IsNumber()
  numNfts: number;
}
