import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional } from 'class-validator';
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
