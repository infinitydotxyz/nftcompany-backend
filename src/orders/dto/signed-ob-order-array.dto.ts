import { ApiProperty } from '@nestjs/swagger';
import { SignedOBOrderDto } from './signed-ob-order.dto';

export class SignedOBOrderArrayDto {
  @ApiProperty({ description: 'Array of signed orders', type: [SignedOBOrderDto] })
  data: SignedOBOrderDto[];

  @ApiProperty({ description: 'Cursor that can be used to get the next page' })
  cursor: string;

  @ApiProperty({ description: 'Whether there are more results available' })
  hasNextPage: boolean;
}
