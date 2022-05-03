import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { round } from 'lodash';

export enum Currency {
  ETH = 'ETH',
  WETH = 'WETH'
}

export class PriceFilterDto {
  @ApiPropertyOptional({
    description: 'Currency to filter by',
    enum: Currency
  })
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency;

  @ApiPropertyOptional({
    description: 'Min price to filter by'
  })
  @Transform((params) => {
    const value = parseFloat(params.value);
    if (!Number.isNaN(value)) {
      return round(value, 6);
    }
    return undefined;
  })
  @IsNumber({
    maxDecimalPlaces: 6
  })
  @IsOptional()
  minPrice?: number;

  @ApiPropertyOptional({
    description: 'Max price to filter by'
  })
  @IsOptional()
  @Transform((params) => {
    const value = parseFloat(params.value);
    if (!Number.isNaN(value)) {
      return round(value, 6);
    }
    return undefined;
  })
  @IsNumber({
    maxDecimalPlaces: 6
  })
  maxPrice?: number;
}
