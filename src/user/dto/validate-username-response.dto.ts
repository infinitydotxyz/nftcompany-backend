import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ValidateUsernameResponseDto {
  @ApiProperty({
    description: 'The requested username'
  })
  username: string;

  @ApiProperty({
    description: 'Whether the username is valid or not'
  })
  valid: boolean;

  @ApiPropertyOptional({
    description: 'Reason the username is invalid (only returned if invalid)'
  })
  reason?: string;

  @ApiPropertyOptional({
    description: 'Suggested available usernames (only returned if invalid)'
  })
  suggestions?: string[];
}
