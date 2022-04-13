import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { parseIntTransformer } from 'common/transformers/parse-int.transformer';
import { Transform } from 'class-transformer';
import { ActivityType } from '../nft-activity.types';
import { IsEnumArray } from 'common/decorators/is-enum-array.decorator';

export class NftActivityFilters {
  @ApiProperty({
    description: 'Activity types to include in the response',
    enum: ActivityType,
    type: [ActivityType]
  })
  @IsEnumArray(ActivityType, { message: 'Invalid event type' })
  eventType!: ActivityType[];

  @ApiProperty({
    description: 'Max number of events to get. Max of 50'
  })
  @IsNumber()
  @Transform(parseIntTransformer({ max: 50 }))
  limit!: number;

  @ApiPropertyOptional({
    description: 'Cursor to start after'
  })
  @IsString()
  @IsOptional()
  cursor?: string;
}
