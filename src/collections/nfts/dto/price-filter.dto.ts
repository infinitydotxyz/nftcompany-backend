import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional } from 'class-validator';
import { roundNumberTransformer } from 'common/transformers/round-number.transformer';

const CURRENCY_PRECISION = 18;
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
  @Transform(roundNumberTransformer(CURRENCY_PRECISION))
  @IsNumber({
    maxDecimalPlaces: CURRENCY_PRECISION
  })
  @IsOptional()
  minPrice?: number;

  @ApiPropertyOptional({
    description: 'Max price to filter by'
  })
  @Transform(roundNumberTransformer(CURRENCY_PRECISION))
  @IsNumber({
    maxDecimalPlaces: CURRENCY_PRECISION
  })
  @IsOptional()
  maxPrice?: number;
}
