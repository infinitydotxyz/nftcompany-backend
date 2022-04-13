import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { parseIntTransformer } from 'common/transformers/parse-int.transformer';

export class CollectionSearchQueryDto {
  @ApiProperty({
    description: 'The value to be searched for'
  })
  @IsString()
  @IsOptional()
  query?: string;

  @ApiProperty({
    description: 'Number of results to get. Max of 100'
  })
  @IsNumber()
  @Transform(parseIntTransformer({ max: 100 }))
  limit!: number;

  @ApiPropertyOptional({
    description: 'Cursor to start after'
  })
  @IsString()
  @IsOptional()
  cursor?: string;
}
