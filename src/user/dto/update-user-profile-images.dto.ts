import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { parseBoolTransformer } from 'common/transformers/parse-bool.transformer';

export class UpdateUserProfileImagesDto {
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
