import { Erc721Metadata } from '@infinityxyz/lib/types/core';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Erc721AttributeDto } from './erc721-attribute.dto';

export class Erc721MetadataDto implements Erc721Metadata {
  @ApiPropertyOptional({
    description: 'Name of the item'
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Title of the item'
  })
  title: string;

  @ApiPropertyOptional({
    description: 'URL to the image of the item'
  })
  image: string;
  /**
   * Raw svg image data
   */
  @ApiPropertyOptional({
    description: 'raw svg image data'
  })
  image_data: string;

  @ApiPropertyOptional({
    description: 'External url for the item'
  })
  external_url: string;

  @ApiPropertyOptional({
    description: 'Description of the item'
  })
  description: string;

  @ApiPropertyOptional({
    description: 'Background color of the item (6 decimal hexadecimal without #)'
  })
  background_color: string;

  @ApiPropertyOptional({
    description: 'URL to a multi-media attachment for the item'
  })
  animation_url: string;

  @ApiPropertyOptional({
    description: 'URL to a youtube video'
  })
  youtube_url: string;

  @ApiPropertyOptional({
    description: 'Attributes for the item',
    type: [Erc721AttributeDto]
  })
  attributes: Erc721AttributeDto[];
}
