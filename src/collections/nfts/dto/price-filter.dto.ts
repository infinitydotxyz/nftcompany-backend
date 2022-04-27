import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional } from 'class-validator';

export enum SupportedCurrency {
  Eth = 'ETH'
}

export class PriceFilterDto {
  @ApiPropertyOptional({
    description: 'Currency to filter by',
    enum: SupportedCurrency
  })
  @IsEnum(SupportedCurrency)
  @IsOptional()
  currency?: SupportedCurrency;

  @ApiPropertyOptional({
    description: 'Min price to filter by'
  })
  @IsNumber()
  @IsOptional()
  minPrice?: number;

  @ApiPropertyOptional({
    description: 'Max price to filter by'
  })
  @IsNumber()
  @IsOptional()
  maxPrice?: number;
}
