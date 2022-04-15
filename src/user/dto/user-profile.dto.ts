import { ApiProperty } from '@nestjs/swagger';

export class UserProfileDto {
  @ApiProperty({
    description: "User's main wallet address"
  })
  address: string;

  @ApiProperty({
    description: 'Non-unique name of the user'
  })
  displayName: string;

  @ApiProperty({
    description: 'Unique username for the user'
  })
  username: string;

  @ApiProperty({
    description: "User's bio"
  })
  bio: string;

  @ApiProperty({
    description: "User's profile image"
  })
  profileImage: string;

  @ApiProperty({
    description: "User's banner image"
  })
  bannerImage: string;

  @ApiProperty({
    description: "User's discord username"
  })
  discordUsername: string;

  @ApiProperty({
    description: "User's twitter username"
  })
  twitterUsername: string;

  @ApiProperty({
    description: "User's instagram username"
  })
  instagramUsername: string;

  @ApiProperty({
    description: "User's facebook username"
  })
  facebookUsername: string;

  @ApiProperty({
    description: "User's linked wallet addresses"
  })
  wallets: string[];

  @ApiProperty({
    description: "Date the user's profile was created. Epoch ms"
  })
  createdAt: number;

  @ApiProperty({
    description: "Date the user's profile was updated. Epoch ms"
  })
  updatedAt: number;
}
