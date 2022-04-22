import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested, IsArray, IsString, IsNumber, IsBoolean, IsNotEmpty, IsEthereumAddress } from 'class-validator';
import { ChainOBOrderDto } from './chain-ob-order.dto';
import { ExecParamsDto } from './exec-params.dto';
import { ExtraParamsDto } from './extra-params.dto';
import { OBOrderItemDto } from './ob-order-item.dto';

export class SignedOBOrderDto {
  @ApiProperty({
    description: 'Order id'
  })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({
    description: 'Chain id'
  })
  @IsString()
  @IsNotEmpty()
  chainId: string;

  @ApiProperty({
    description: 'Whether the order a sell or buy'
  })
  @IsBoolean()
  isSellOrder: boolean;

  @ApiProperty({
    description: 'Number of items in the order'
  })
  @IsNumber()
  @IsNotEmpty()
  numItems: number;

  @ApiProperty({
    description: 'Maker username of the order'
  })
  @IsString()
  makerUsername: string;

  @ApiProperty({
    description: 'Maker address of the order'
  })
  @IsString()
  @IsNotEmpty()
  @IsEthereumAddress()
  makerAddress: string;

  @ApiProperty({
    description: 'Starting price in ETH of the order'
  })
  @IsNumber()
  @IsNotEmpty()
  startPriceEth: number;

  @ApiProperty({
    description: 'Ending price in ETH of the order'
  })
  @IsNumber()
  @IsNotEmpty()
  endPriceEth: number;

  @ApiProperty({
    description: 'Starting time in milliseconds since epoch of the order'
  })
  @IsNumber()
  @IsNotEmpty()
  startTimeMs: number;

  @ApiProperty({
    description: 'Ending time in milliseconds since epoch of the order'
  })
  @IsNumber()
  @IsNotEmpty()
  endTimeMs: number;

  @ApiProperty({
    description: 'Minimum percentage in bps a seller should get after all fees'
  })
  @IsNumber()
  @IsNotEmpty()
  minBpsToSeller: number;

  @ApiProperty({
    description: 'Order nonce'
  })
  @IsString()
  @IsNotEmpty()
  nonce: string;

  @ApiProperty({
    description: 'NFTs in the order'
  })
  @ValidateNested({ each: true })
  @Type(() => OBOrderItemDto)
  @IsArray()
  nfts: OBOrderItemDto[];

  @ApiProperty({
    description: 'Execution params like txn currency and type of order'
  })
  @ValidateNested()
  @Type(() => ExecParamsDto)
  execParams: ExecParamsDto;

  @ApiProperty({
    description: 'NFTs in the order'
  })
  @ValidateNested()
  @Type(() => ExtraParamsDto)
  extraParams: ExtraParamsDto;

  @ApiProperty({
    description: 'Order in the format reqd by exchange contracts'
  })
  @ValidateNested()
  @Type(() => ChainOBOrderDto)
  signedOrder: ChainOBOrderDto;
}
