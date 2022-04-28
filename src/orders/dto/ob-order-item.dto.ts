import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEthereumAddress, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { OBTokenInfoDto } from './ob-token-info.dto';

export class OBOrderItemDto {
  @ApiProperty({
    description: 'Collection address'
  })
  @IsString()
  @IsNotEmpty()
  @IsEthereumAddress()
  collectionAddress: string;

  // @ApiProperty({
  //   description: 'Collection name'
  // })
  // @IsString()
  // @IsNotEmpty()
  // collectionName: string;

  // @ApiProperty({
  //   description: 'Profile image url'
  // })
  // @IsString()
  // @IsNotEmpty()
  // collectionImage: string;

  @ApiProperty({
    description: 'Tokens in the order'
  })
  @ValidateNested({ each: true })
  @Type(() => OBTokenInfoDto)
  @IsArray()
  tokens: OBTokenInfoDto[];
}
