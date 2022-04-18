import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEthereumAddress, IsNumber, IsString, MaxLength, MinLength } from 'class-validator';
import { normalizeAddressTransformer } from 'common/transformers/normalize-address.transformer';
import { ProfileService } from 'user/profile.service';

export class UserProfileDto {
  @ApiProperty({
    description: "User's main wallet address"
  })
  @IsEthereumAddress({
    message: 'Invalid address'
  })
  @Transform(normalizeAddressTransformer)
  address: string;

  @ApiProperty({
    description: 'Non-unique name of the user'
  })
  @IsString()
  @MaxLength(ProfileService.MAX_DISPLAY_NAME_CHARS)
  displayName: string;

  @ApiProperty({
    description: 'Unique username for the user'
  })
  @IsString()
  @MinLength(ProfileService.MIN_USERNAME_CHARS)
  @MaxLength(ProfileService.MAX_USERNAME_CHARS)
  username: string;

  @ApiProperty({
    description: "User's bio"
  })
  @IsString()
  @MaxLength(ProfileService.MAX_BIO_CHARS)
  bio: string;

  @ApiProperty({
    description: "User's profile image"
  })
  @IsString()
  profileImage: string;

  @ApiProperty({
    description: "User's banner image"
  })
  @IsString()
  bannerImage: string;

  @ApiProperty({
    description: "User's discord username"
  })
  @IsString()
  discordUsername: string;

  @ApiProperty({
    description: "User's twitter username"
  })
  @IsString()
  twitterUsername: string;

  @ApiProperty({
    description: "User's instagram username"
  })
  @IsString()
  instagramUsername: string;

  @ApiProperty({
    description: "User's facebook username"
  })
  @IsString()
  facebookUsername: string;

  @ApiProperty({
    description: "Date the user's profile was created. Epoch ms"
  })
  @IsNumber()
  createdAt: number;

  @ApiProperty({
    description: "Date the user's profile was updated. Epoch ms"
  })
  @IsNumber()
  updatedAt: number;
}
