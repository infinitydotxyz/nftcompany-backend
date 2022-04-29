import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEthereumAddress, IsNotEmpty, IsString } from 'class-validator';
import { normalizeAddressTransformer } from '../../common/transformers/normalize-address.transformer';

export class ExecParamsDto {
  @ApiProperty({
    description: 'Order execution type'
  })
  @IsString()
  @IsNotEmpty()
  @IsEthereumAddress()
  @Transform(normalizeAddressTransformer)
  complicationAddress: string;

  @ApiProperty({
    description: 'Txn currency address, for e.g: WETH'
  })
  @IsString()
  @IsNotEmpty()
  @IsEthereumAddress()
  @Transform(normalizeAddressTransformer)
  currencyAddress: string;
}
