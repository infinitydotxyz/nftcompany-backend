import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { parseBoolTransformer } from 'common/transformers/parse-bool.transformer';

export class UserProfileImagesDto {
  @ApiPropertyOptional({
    description: 'Profile image to upload',
    type: 'file',
    format: 'binary'
  })
  profileImage: Express.Multer.File[];

  @ApiPropertyOptional({
    description: 'Banner image to upload',
    type: 'file',
    format: 'binary'
  })
  bannerImage: Express.Multer.File[];
}

export class DeleteUserProfileImagesDto {
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

export class UpdateUserProfileImagesDto extends IntersectionType(UserProfileImagesDto, DeleteUserProfileImagesDto) {}
