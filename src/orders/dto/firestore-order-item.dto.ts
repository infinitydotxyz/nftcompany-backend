import { FirestoreOrderItem, OBOrderStatus } from '@infinityxyz/lib/types/core/OBOrder';
import { ApiProperty } from '@nestjs/swagger/dist';
import { IsBoolean, IsEnum, IsEthereumAddress, IsNumber, IsString } from 'class-validator';

export class FirestoreOrderItemDto implements FirestoreOrderItem {
  @ApiProperty({
    description: 'Unique id of the corresponding order'
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Status of the order',
    enum: OBOrderStatus
  })
  @IsEnum(OBOrderStatus)
  orderStatus: OBOrderStatus;

  @ApiProperty({
    description: 'Chain id for the order'
  })
  @IsString()
  chainId: string;

  @ApiProperty({
    description: 'Whether the order is a sell order (i.e. listing)'
  })
  @IsBoolean()
  isSellOrder: boolean;

  @ApiProperty({
    description: 'The quantity of this token to be exchanged'
  })
  @IsNumber()
  numItems: number;

  @ApiProperty({
    description: 'Starting price of the order in ETH'
  })
  @IsNumber()
  startPriceEth: number;

  @ApiProperty({
    description: 'Ending price of the order in ETH'
  })
  @IsNumber()
  endPriceEth: number;

  @ApiProperty({
    description: 'Time that the order becomes valid. Epoch timestamp (ms)'
  })
  @IsNumber()
  startTimeMs: number;

  @ApiProperty({
    description: 'Time that the order is no longer valid after. Epoch timestamp (ms)'
  })
  @IsNumber()
  endTimeMs: number;

  @ApiProperty({
    description: 'The username of the maker of the order'
  })
  @IsString()
  makerUsername: string;

  @ApiProperty({
    description: 'The address of the maker of the order'
  })
  @IsString()
  makerAddress: string;

  @ApiProperty({
    description: 'The username of the taker of the order'
  })
  @IsString()
  takerUsername: string;

  @ApiProperty({
    description: 'The address of the taker of the order'
  })
  @IsString()
  takerAddress: string;

  @ApiProperty({
    description: 'Address of the corresponding collection'
  })
  @IsEthereumAddress()
  collectionAddress: string;

  @ApiProperty({
    description: 'Name of the corresponding collection'
  })
  @IsString()
  collectionName: string;

  @ApiProperty({
    description: 'Profile image of the collection'
  })
  @IsString()
  collectionImage: string;

  @ApiProperty({
    description: 'Token id that this order item is for'
  })
  @IsString()
  tokenId: string;

  @ApiProperty({
    description: 'Name of the token'
  })
  @IsString()
  tokenName: string;

  @ApiProperty({
    description: 'Image for the token'
  })
  @IsString()
  tokenImage: string;

  @ApiProperty({
    description: 'Total number of tokens in the order'
  })
  @IsNumber()
  numTokens: number;
}
