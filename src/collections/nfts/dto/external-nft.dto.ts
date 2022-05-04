import { ApiProperty } from '@nestjs/swagger';
import { NftDto } from './nft.dto';

export class ExternalNftDto extends NftDto {
  @ApiProperty({
    description: 'Whether the nft is supported'
  })
  isSupported: boolean;
}
