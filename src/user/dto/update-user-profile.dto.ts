import { ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { UserProfileDto } from './user-profile.dto';

export class UpdateUserProfileDto extends PickType(UserProfileDto, [
  'displayName',
  'username',
  'bio',
  'discordUsername',
  'twitterUsername',
  'instagramUsername',
  'facebookUsername'
] as const) {
  @ApiPropertyOptional({
    description: 'Whether to remove the current profile image'
  })
  @IsBoolean()
  @IsOptional()
  deleteProfileImage?: boolean;

  @ApiPropertyOptional({
    description: 'Whether to remove the current banner image'
  })
  @IsBoolean()
  @IsOptional()
  deleteBannerImage?: boolean;
}
