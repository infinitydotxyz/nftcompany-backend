import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEthereumAddress } from 'class-validator';
import { normalizeAddressTransformer } from 'common/transformers/normalize-address.transformer';

export class UserDto {
  @ApiProperty({
    description: 'User wallet address'
  })
  @IsEthereumAddress({
    message: 'Invalid address'
  })
  @Transform(normalizeAddressTransformer)
  readonly userAddress: string;
}
