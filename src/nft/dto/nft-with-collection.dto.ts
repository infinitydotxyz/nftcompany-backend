import { ApiProperty } from '@nestjs/swagger';
import { CollectionDto } from 'collection/dto/collection.dto';
import { NftDto } from './nft.dto';

export class NftWithCollectionDto {
  @ApiProperty({ description: 'The Nft' })
  nft: NftDto;

  @ApiProperty({
    description: 'The collection that the Nft belongs to'
  })
  collection: CollectionDto;
}
