import { ChainId } from '@infinityxyz/lib/types/core';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsEthereumAddress } from 'class-validator';

export class UserFollowingCollection {

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
