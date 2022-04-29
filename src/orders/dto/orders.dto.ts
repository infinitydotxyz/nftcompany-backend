import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested, IsArray } from 'class-validator';
import { SignedOBOrderDto } from './signed-ob-order.dto';

export class OrdersDto {
  @ApiProperty({
    description: 'Orders to be saved'
  })
  @ValidateNested({ each: true, message: 'Invalid signed order' })
  @Type(() => SignedOBOrderDto)
  @IsArray()
  orders: SignedOBOrderDto[];
}
