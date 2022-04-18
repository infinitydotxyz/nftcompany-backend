import { ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsBooleanString, IsOptional } from 'class-validator';
import { parseBoolTransformer } from 'common/transformers/parse-bool.transformer';
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
  @Transform(parseBoolTransformer({ optional: true }))
  @IsBoolean()
  @IsOptional()
  deleteProfileImage?: boolean;

  @ApiPropertyOptional({
    description: 'Whether to remove the current banner image'
  })
  @Transform(parseBoolTransformer({ optional: true }))
  @IsBoolean()
  @IsOptional()
  deleteBannerImage?: boolean;
}
