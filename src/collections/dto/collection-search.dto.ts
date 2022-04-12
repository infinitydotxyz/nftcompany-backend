import { ChainId } from '@infinityxyz/lib/types/core';
import { ApiProperty } from '@nestjs/swagger';

export class CollectionSearchDto {
  @ApiProperty({
    description: 'Collection address'
  })
  address: string;

  @ApiProperty({
    description: 'Collection chain id',
    enum: ChainId
  })
  chainId: ChainId;

  @ApiProperty({
    description: 'Indicates whether the collection is verified'
  })
  hasBlueCheck: boolean;

  @ApiProperty({
    description: 'Slug of the collection'
  })
  slug: string;

  @ApiProperty({
    description: 'Name of the collection'
  })
  name: string;

  @ApiProperty({
    description: 'Profile Image of the collection'
  })
  profileImage: string;

  @ApiProperty({
    description: 'Description of the collection'
  })
  description: string;
}
