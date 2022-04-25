import { ChainId } from '@infinityxyz/lib/types/core';
import { TokenStandard } from '@infinityxyz/lib/types/core/Token';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Erc721MetadataDto } from './erc721-metadata.dto';
import { NftImageDto } from './nft-image.dto';
import { NftStateDto } from './nft-state.dto';

export class NftDto {
  @ApiProperty({
    description: 'Collection address'
  })
  address: string;

  @ApiProperty({
    description: 'Chain id that the collection is on'
  })
  chainId: ChainId;

  @ApiProperty({
    description: 'The slug for this nft'
  })
  slug: string;

  @ApiProperty({
    description: 'The token id'
  })
  tokenId: string;

  @ApiProperty({
    description: 'The address of the wallet that minted the nft'
  })
  minter: string;

  @ApiProperty({
    description: 'Epoch timestamp (ms) that the nft was minted at'
  })
  mintedAt: number;

  @ApiProperty({
    description: 'The transaction hash for the mint transaction'
  })
  mintTxHash: string;

  @ApiProperty({
    description: 'The price of the mint transaction'
  })
  mintPrice: number;

  @ApiProperty({
    description: 'Epoch timestamp (ms) that the nft was burned at (if it has been burned)'
  })
  destroyedAt?: number;

  @ApiProperty({
    description: 'The metadata for this nft'
  })
  metadata: Erc721MetadataDto;

  @ApiProperty({
    description: 'The number of trait types that this token has'
  })
  numTraitTypes: number;

  @ApiProperty({
    description: 'Epoch timestamp (ms) that the nft was last updated at'
  })
  updatedAt: number;

  @ApiProperty({
    description: 'The token uri for this nft'
  })
  tokenUri: string;

  @ApiProperty({
    description: 'The rank of the nft relative to other nfts in the collection'
  })
  rarityRank: number;

  @ApiProperty({
    description: 'The rarity score for this nft within the collection'
  })
  rarityScore: number;

  @ApiProperty({
    description: 'Object containing images for this token'
  })
  image: NftImageDto;

  @ApiPropertyOptional({
    description: 'The state of the nft'
  })
  state?: NftStateDto;

  @ApiProperty({
    description: 'The standard of the nft',
    enum: TokenStandard
  })
  tokenStandard: TokenStandard;
}
