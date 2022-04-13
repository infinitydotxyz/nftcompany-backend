import { CollectionMetadata } from '@infinityxyz/lib/types/core';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { CollectionIntegrationsDto } from './collection-integrations.dto';
import { CollectionLinksDto } from './collection-links.dto';

export class CollectionPartnershipDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  link!: string;
}

export class CollectionMetaDataDto implements CollectionMetadata {
  @ApiProperty()
  @IsString()
  @IsOptional()
  name!: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  description!: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  symbol!: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  profileImage!: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  bannerImage!: string;

  @ApiProperty()
  @ValidateNested()
  @Type(() => CollectionLinksDto)
  @IsOptional()
  links!: CollectionLinksDto;

  @ApiProperty()
  @IsArray()
  @IsOptional()
  benefits?: string[];

  @ApiProperty()
  @ValidateNested()
  @Type(() => CollectionPartnershipDto)
  @IsOptional()
  @IsArray()
  partnerships?: CollectionPartnershipDto[];

  @ApiProperty()
  @ValidateNested()
  @Type(() => CollectionIntegrationsDto)
  @IsOptional()
  integrations?: CollectionIntegrationsDto;

  @ApiProperty()
  @IsString()
  @IsOptional()
  displayType?: string;
}

export class PartialCollectionMetadataDto extends PartialType(CollectionMetaDataDto) {}
