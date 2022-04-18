import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEthereumAddress } from 'class-validator';
import { normalizeAddressTransformer } from 'common/transformers/normalize-address.transformer';

export class UserFollowingUser {
  @ApiProperty({
    description: 'Address of the following user'
  })
  @IsEthereumAddress()
  @Transform(normalizeAddressTransformer)
  userAddress: string;
}
