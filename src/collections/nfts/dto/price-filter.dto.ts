import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional } from 'class-validator';
import { round } from 'lodash';

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
  @Transform((params) => round(params.value, 6))
  @IsNumber({
    maxDecimalPlaces: 6
  })
  @IsOptional()
  minPrice?: number;

  @ApiPropertyOptional({
    description: 'Max price to filter by'
  })
  @IsNumber()
  @IsOptional()
  maxPrice?: number;
}
