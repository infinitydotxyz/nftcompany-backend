import { ChainId } from '@infinityxyz/lib/types/core';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsEthereumAddress } from 'class-validator';
import { normalizeAddressTransformer } from 'common/transformers/normalize-address.transformer';

export class UserFollowingUser {

  @ApiProperty({
    description: 'Address of the following user'
  })
  @IsEthereumAddress()
  @Transform(normalizeAddressTransformer)
  userAddress: string;

  @ApiProperty({
    description: 'Chain id of the following user',
    enum: ChainId
  })
  @IsEnum(ChainId)
  userChainId: ChainId;
}
