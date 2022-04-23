import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsNumber, IsString } from 'class-validator';
import { ActivityType } from 'collections/nfts/nft-activity.types';
import { IsEnumArray } from 'common/decorators/is-enum-array.decorator';
import { arrayTransformer } from 'common/transformers/array-query.transformer';
import { parseIntTransformer } from 'common/transformers/parse-int.transformer';

export class UserActivityQueryDto {
  @ApiProperty({
    description: 'Activity types to include in the response',
    enum: ActivityType,
    type: [ActivityType]
  })
  @IsEnumArray(ActivityType, { message: 'Invalid event type' })
  @Transform(arrayTransformer)
  events: ActivityType[];

  @ApiProperty({
    description: 'Max number of events to get. Max of 50'
  })
  @IsNumber()
  @Transform(parseIntTransformer({ max: 50 }))
  limit: number;

  @ApiPropertyOptional({
    description: 'Cursor to start after'
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
