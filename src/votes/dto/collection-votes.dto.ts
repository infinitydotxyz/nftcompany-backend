import { ChainId } from '@infinityxyz/lib/types/core';
import { ApiProperty } from '@nestjs/swagger';
import { IsEthereumAddress, IsEnum, IsNumber } from 'class-validator';

export class CollectionVotesDto {
  @ApiProperty({
    description: 'Address of the collection being voted on'
  })
  @IsEthereumAddress()
  collectionAddress!: string;

  @ApiProperty({
    description: 'Chain id of the collection being voted on',
    enum: ChainId
  })
  @IsEnum(ChainId)
  collectionChainId!: ChainId;

  @ApiProperty({
    description: 'The number of votes for the collection'
  })
  @IsNumber()
  votesFor!: number;

  @ApiProperty({
    description: 'The number of votes against the collection'
  })
  @IsNumber()
  votesAgainst!: number;
}
