import { SignedOBOrderSpec } from '@infinityxyz/lib/types/core';
import { ApiProperty } from '@nestjs/swagger';

export class OrdersDto {
  @ApiProperty({
    description: 'Orders to be saved'
  })
  orders!: SignedOBOrderSpec[];
}
