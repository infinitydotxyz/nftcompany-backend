import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEthereumAddress, IsOptional } from 'class-validator';
import { normalizeAddressTransformer } from 'common/transformers/normalize-address.transformer';
import { OrderItemsQueryDto } from './order-items-query.dto';

export class UserOrderItemsQueryDto extends OrderItemsQueryDto {
  @ApiPropertyOptional({
    description: 'Maker address to filter orders by'
  })
  @IsOptional()
  @Transform(normalizeAddressTransformer)
  @IsEthereumAddress()
  makerAddress?: string;

  @ApiPropertyOptional({
    description: 'Taker address to filter orders by'
  })
  @IsOptional()
  @Transform(normalizeAddressTransformer)
  @IsEthereumAddress()
  takerAddress?: string;
}
