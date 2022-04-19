import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEthereumAddress, IsNumber, IsString, MaxLength } from 'class-validator';
import { normalizeAddressTransformer } from 'common/transformers/normalize-address.transformer';
import { IsUsername } from 'user/profile/is-username.decorator';
import { MAX_BIO_CHARS, MAX_DISPLAY_NAME_CHARS, usernameConstraints } from 'user/profile/profile.constants';

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
  @MaxLength(MAX_DISPLAY_NAME_CHARS)
  displayName: string;

  @ApiProperty({
    description: `Unique username for the user (${usernameConstraints})`
  })
  @IsUsername()
  username: string;

  @ApiProperty({
    description: `User's bio. Max ${MAX_BIO_CHARS} characters`
  })
  @IsString()
  @MaxLength(MAX_BIO_CHARS)
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
