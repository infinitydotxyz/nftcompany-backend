import { CreationFlow } from '@infinityxyz/lib/types/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CollectionStateCreateDto {
  @ApiProperty({
    description: 'Current step of the collection creation process',
    enum: CreationFlow
  })
  step: CreationFlow;
  @ApiProperty({
    description: 'Epoch timestamp (ms) that the collection creation process was last updated at'
  })
  updatedAt: number;
  @ApiPropertyOptional({
    description: 'Error that occurred during the collection creation process, if any'
  })
  error?: Record<string, any>;
  @ApiProperty({
    description: 'Progress of the collection creation process'
  })
  progress: number;
}
