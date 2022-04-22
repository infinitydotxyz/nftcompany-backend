import { ApiProperty } from '@nestjs/swagger';
import { IsEthereumAddress, IsNotEmpty, IsString } from 'class-validator';

export class ExecParamsDto {
  @ApiProperty({
    description: 'Order execution type'
  })
  @IsString()
  @IsNotEmpty()
  @IsEthereumAddress()
  complicationAddress: string;

  @ApiProperty({
    description: 'Txn currency address, for e.g: WETH'
  })
  @IsString()
  @IsNotEmpty()
  @IsEthereumAddress()
  currencyAddress: string;
}
