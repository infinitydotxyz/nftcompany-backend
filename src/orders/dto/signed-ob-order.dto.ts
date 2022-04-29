import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested, IsString, IsNumber, IsNotEmpty } from 'class-validator';
import { ChainOBOrderDto } from './chain-ob-order.dto';
import { ExecParamsDto } from './exec-params.dto';
import { ExtraParamsDto } from './extra-params.dto';

export class SignedOBOrderDto {
  @ApiProperty({
    description: 'Chain id'
  })
  @IsString()
  @IsNotEmpty()
  chainId: string;

  @ApiProperty({
    description: 'Starting price in ETH of the order'
  })
  @IsNumber()
  startPriceEth: number;

  @ApiProperty({
    description: 'Ending price in ETH of the order'
  })
  @IsNumber()
  endPriceEth: number;

  @ApiProperty({
    description: 'Starting time in milliseconds since epoch of the order'
  })
  @IsNumber()
  startTimeMs: number;

  @ApiProperty({
    description: 'Ending time in milliseconds since epoch of the order'
  })
  @IsNumber()
  endTimeMs: number;

  @ApiProperty({
    description: 'Minimum percentage in bps a seller should get after all fees'
  })
  @IsNumber()
  minBpsToSeller: number;

  @ApiProperty({
    description: 'Order nonce'
  })
  @IsString()
  nonce: string;

  @ApiProperty({
    description: 'Execution params like txn currency and type of order'
  })
  @ValidateNested({ message: 'Invalid exec params' })
  @Type(() => ExecParamsDto)
  execParams: ExecParamsDto;

  @ApiProperty({
    description: 'Extra params for the order'
  })
  @ValidateNested({ message: 'Invalid extra params' })
  @Type(() => ExtraParamsDto)
  extraParams: ExtraParamsDto;

  @ApiProperty({
    description: 'Order in the format required by exchange contracts'
  })
  @ValidateNested({ message: 'Invalid signed order' })
  @Type(() => ChainOBOrderDto)
  signedOrder: ChainOBOrderDto;
}
