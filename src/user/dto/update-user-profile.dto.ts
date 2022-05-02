import { PartialType, PickType } from '@nestjs/swagger';
import { UserProfileDto } from './user-profile.dto';

export class UpdateUserProfileDto extends PickType(UserProfileDto, [
  'displayName',
  'username',
  'bio',
  'discordUsername',
  'twitterUsername',
  'instagramUsername',
  'facebookUsername'
] as const) {}

export class PartialUpdateUserProfileDto extends PartialType(UpdateUserProfileDto) {}
