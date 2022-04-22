import { ApiProperty } from '@nestjs/swagger';

export class UserCollectionPermissions {
  @ApiProperty({ description: 'Whether the user can modify this collection' })
  canModify: boolean;
}
