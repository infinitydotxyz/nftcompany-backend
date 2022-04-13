import { InfinityTwitterAccount } from '@infinityxyz/lib/types/services/twitter';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TwitterAccountDto implements InfinityTwitterAccount {
  @ApiProperty({
    description: 'Twitter id of the account'
  })
  id!: string;

  @ApiProperty({
    description: "User's display name on Twitter"
  })
  name!: string;

  @ApiProperty({
    description: 'Twitter username of the account'
  })
  username!: string;

  @ApiProperty({
    description: 'Number of followers the account has'
  })
  followersCount!: number;

  @ApiProperty({
    description: 'Number of accounts the account is following'
  })
  followingCount!: number;

  @ApiPropertyOptional({
    description: 'Number of tweets the account has posted'
  })
  tweetCount?: number;

  @ApiPropertyOptional({
    description: 'Number of public lists that the account is a member of'
  })
  listedCount?: number;

  @ApiPropertyOptional({
    description: 'Profile image url of the account'
  })
  profileImageUrl?: string;
}
