import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger/dist/decorators/api-property.decorator';
import { IsEnum, IsNumber, IsOptional } from 'class-validator';

export enum Currency {
  Eth = 'ETH'
}

export class PriceFilterDto {
  @ApiProperty({
    description: 'Currency to use for min price and max price'
  })
  @IsEnum(Currency)
  currency: Currency;

  @ApiPropertyOptional({
    description: 'Minimum price to filter by'
  })
  @IsNumber()
  @IsOptional()
  minPrice?: number;

  @ApiPropertyOptional({
    description: 'Maximum price to filter by'
  })
  @IsNumber()
  @IsOptional()
  maxPrice?: number;
}
