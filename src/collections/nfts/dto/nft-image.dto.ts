import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NftImageDto {
  @ApiProperty({
    description: 'The image url hosted on a CDN'
  })
  url!: string;

  @ApiPropertyOptional({})
  originalUrl!: "The original url of the image (from the nft's metadata)";

  @ApiProperty({
    description: 'Epoch timestamp (ms) that the image was last updated at'
  })
  updatedAt!: number;
}
