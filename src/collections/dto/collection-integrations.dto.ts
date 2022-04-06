import { CollectionIntegrations, DiscordIntegration } from '@infinityxyz/lib/types/core';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';

export class DiscordIntegrationDto implements DiscordIntegration {
  @ApiProperty()
  @IsOptional()
  @IsArray()
  channels?: string[];

  @ApiProperty()
  @IsOptional()
  guildId?: string;
}

export class CollectionIntegrationsDto implements CollectionIntegrations {
  @ApiProperty()
  @IsOptional()
  @ValidateNested()
  @Type(() => DiscordIntegrationDto)
  discord?: DiscordIntegrationDto;
}
