import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ExtraParamsDto {
  @ApiProperty({
    description: 'Buyer of the order'
  })
  @IsString()
  @IsOptional()
  buyer: string;
}
