import { OBOrderItem, SignedOBOrder } from '@infinityxyz/lib/types/core';
import { ApiProperty, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested, IsString, IsNumber, IsNotEmpty } from 'class-validator';
import { ChainOBOrderDto } from './chain-ob-order.dto';
import { ExecParamsDto } from './exec-params.dto';
import { ExtraParamsDto } from './extra-params.dto';

export class SignedOBOrderDto implements Omit<SignedOBOrder, 'nonce'> {
  @ApiProperty({
    description: 'id of the order'
  })
  id: string;

  @ApiProperty({
    description: 'Whether the order is a sell order or not'
  })
  isSellOrder: boolean;

  @ApiProperty({
    description: 'The username of the maker of the order'
  })
  makerUsername: string;

  @ApiProperty({
    description: 'The maker of the order'
  })
  makerAddress: string;

  @ApiProperty({
    description: 'Order item in this order'
  })
  nfts: OBOrderItem[];

  @ApiProperty({
    description: 'Chain id'
  })
  @IsString()
  @IsNotEmpty()
  chainId: string;

  @ApiProperty({
    description: 'Number of items in the order'
  })
  @IsNumber()
  numItems: number;

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
  @IsNumber()
  nonce: number;

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

export class CreateOrderDto extends PickType(SignedOBOrderDto, [
  'chainId',
  'numItems',
  'startPriceEth',
  'endPriceEth',
  'startTimeMs',
  'endTimeMs',
  'minBpsToSeller',
  'nonce',
  'execParams',
  'extraParams',
  'signedOrder'
] as const) {}
