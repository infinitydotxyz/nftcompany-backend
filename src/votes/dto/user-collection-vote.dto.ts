import { ChainId } from '@infinityxyz/lib/types/core';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsEthereumAddress, IsNumber } from 'class-validator';

export class UserCollectionVoteDto {
  @ApiProperty({
    description: "User's wallet address"
  })
  @IsEthereumAddress()
  userAddress!: string;

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
    description: 'Whether the user voted for or against the prompt'
  })
  @IsBoolean()
  votedFor!: boolean;

  @ApiProperty({
    description: 'Epoch timestamp (ms) that the vote was cast'
  })
  @IsNumber()
  updatedAt!: number;
}
