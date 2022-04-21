import { BigNumber } from '@ethersproject/bignumber/lib/bignumber';
import { TokenStandard } from '@infinityxyz/lib/types/core';
import { ChainId } from '@infinityxyz/lib/types/core/ChainId';
import { Injectable } from '@nestjs/common/decorators/core/injectable.decorator';
import { PipeTransform } from '@nestjs/common/interfaces/features/pipe-transform.interface';
import { NftDto } from 'collections/nfts/dto/nft.dto';
import { NftsService } from 'collections/nfts/nfts.service';
import { AlchemyNft, AlchemyNftWithMetadata } from './alchemy.types';

@Injectable()
export class AlchemyNftToInfinityNft
  implements PipeTransform<{ alchemyNft: AlchemyNft; chainId: ChainId }, Promise<NftDto | null>>
{
  constructor(private nftsService: NftsService) {}

  async transform({ alchemyNft, chainId }: { alchemyNft: AlchemyNft; chainId: ChainId }): Promise<NftDto | null> {
    const tokenId = BigNumber.from(alchemyNft.id.tokenId).toString();
    if (!('metadata' in alchemyNft)) {
      const nft = await this.nftsService.getNft({
        address: alchemyNft.contract.address,
        chainId,
        tokenId
      });

      if (nft) {
        return nft;
      }
      return null;
    }

    if ((alchemyNft as AlchemyNftWithMetadata).id.tokenMetadata.tokenType !== TokenStandard.ERC721) {
      return null;
    }

    const nft = await this.nftsService.getNft({
      address: alchemyNft.contract.address,
      chainId,
      tokenId
    });
    const metadata = nft?.metadata ?? (alchemyNft.metadata as any);

    return {
      address: alchemyNft.contract.address,
      chainId,
      slug: nft?.slug ?? '',
      tokenId: tokenId,
      minter: nft?.minter ?? '',
      mintedAt: nft?.mintedAt ?? NaN,
      mintTxHash: nft?.mintTxHash ?? '',
      mintPrice: nft?.mintPrice ?? NaN,
      metadata,
      numTraitTypes: nft?.numTraitTypes ?? metadata?.attributes?.length ?? 0,
      updatedAt: nft?.updatedAt ?? NaN,
      tokenUri: nft?.tokenUri ?? alchemyNft.tokenUri?.raw ?? '',
      rarityRank: nft?.rarityRank ?? NaN,
      rarityScore: nft?.rarityScore ?? NaN,
      image: nft?.image ?? {
        url: alchemyNft?.media?.gateway ?? '',
        originalUrl: alchemyNft?.media?.raw ?? '',
        updatedAt: NaN
      },
      state: nft?.state ?? undefined,
      tokenStandard: TokenStandard.ERC721
    };
  }
}
