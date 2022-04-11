import { ChainId } from '@infinityxyz/lib/types/core';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsEthereumAddress, IsNumber } from 'class-validator';

export class UserFollowingCollection {
  @ApiProperty({
    description: "User's wallet address"
  })
  @IsEthereumAddress()
  userAddress: string;

  @ApiProperty({
    description: 'Address of the following collection'
  })
  @IsEthereumAddress()
  collectionAddress: string;

  @ApiProperty({
    description: 'Chain id of the following collection',
    enum: ChainId
  })
  @IsEnum(ChainId)
  collectionChainId: ChainId;
}
