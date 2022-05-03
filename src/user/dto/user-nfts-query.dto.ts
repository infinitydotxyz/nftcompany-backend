import { ChainId } from '@infinityxyz/lib/types/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsString, IsOptional } from 'class-validator';
import { IsSupportedChainId } from 'common/decorators/is-supported-chain-id.decorator';
import { parseIntTransformer } from 'common/transformers/parse-int.transformer';

export class UserNftsQueryDto {
  @ApiProperty({
    description: 'Chain id to get nfts for',
    enum: ChainId
  })
  @IsSupportedChainId({ message: 'Invalid chain id' })
  chainId: ChainId;

  @ApiProperty({
    description: 'Number of results to get. Max of 50'
  })
  @IsNumber()
  @Transform(parseIntTransformer({ max: 50 }))
  limit: number;

  @ApiPropertyOptional({
    description: 'Cursor to start after'
  })
  @IsString()
  @IsOptional()
  cursor?: string;
}
