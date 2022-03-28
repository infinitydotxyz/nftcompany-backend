import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({
    description: 'Whether the request was successful'
  })
  success: boolean;

  @ApiProperty({
    description: 'A message indicating what happened'
  })
  message: string;

  @ApiProperty({
    description: 'The the error occurred'
  })
  timestamp: number;

  @ApiProperty({
    description: 'The http status code'
  })
  statusCode: number;

  @ApiProperty({
    description: 'The path that was requested'
  })
  path: string;
}
