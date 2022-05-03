import { BigNumber } from '@ethersproject/bignumber/lib/bignumber';
import { TokenStandard } from '@infinityxyz/lib/types/core';
import { ChainId } from '@infinityxyz/lib/types/core/ChainId';
import { Injectable } from '@nestjs/common/decorators/core/injectable.decorator';
import { PipeTransform } from '@nestjs/common/interfaces/features/pipe-transform.interface';
import { NftDto } from 'collections/nfts/dto/nft.dto';
import { NftsService } from 'collections/nfts/nfts.service';
import { AlchemyNft } from './alchemy.types';

@Injectable()
export class AlchemyNftToInfinityNft
  implements PipeTransform<{ alchemyNft: AlchemyNft; chainId: ChainId }[], Promise<Array<NftDto | null>>>
{
  constructor(private nftsService: NftsService) {}

  async transform(alchemyNfts: { alchemyNft: AlchemyNft; chainId: ChainId }[]): Promise<Array<NftDto | null>> {
    const nftRefProps = alchemyNfts.map((item) => {
      return {
        address: item.alchemyNft.contract.address,
        chainId: item.chainId,
        tokenId: BigNumber.from(item.alchemyNft.id.tokenId).toString()
      };
    });
    const nfts = await this.nftsService.getNfts(nftRefProps);

    return nfts.map((nftDto, index) => {
      const { alchemyNft, chainId } = alchemyNfts[index];
      const tokenId = BigNumber.from(alchemyNft.id.tokenId).toString();
      let metadata = nftDto?.metadata;
      if (!('metadata' in alchemyNft)) {
        return nftDto || null;
      }
      if ('metadata' in alchemyNft && !metadata) {
        metadata = alchemyNft.metadata as any;
      }
      if (!metadata) {
        return null;
      }

      return {
        address: alchemyNft.contract.address,
        chainId: chainId,
        slug: nftDto?.slug ?? '',
        tokenId: tokenId,
        minter: nftDto?.minter ?? '',
        mintedAt: nftDto?.mintedAt ?? NaN,
        mintTxHash: nftDto?.mintTxHash ?? '',
        mintPrice: nftDto?.mintPrice ?? NaN,
        metadata,
        numTraitTypes: nftDto?.numTraitTypes ?? metadata?.attributes?.length ?? 0,
        updatedAt: nftDto?.updatedAt ?? NaN,
        tokenUri: nftDto?.tokenUri ?? alchemyNft.tokenUri?.raw ?? '',
        rarityRank: nftDto?.rarityRank ?? NaN,
        rarityScore: nftDto?.rarityScore ?? NaN,
        image: {
          url: (nftDto?.image?.url || alchemyNft?.media?.[0]?.gateway || alchemyNft?.metadata?.image) ?? '',
          originalUrl: (nftDto?.image?.originalUrl || alchemyNft?.media?.[0]?.raw || alchemyNft?.metadata?.image) ?? '',
          updatedAt: nftDto?.image?.updatedAt ?? NaN
        },
        state: nftDto?.state ?? undefined,
        tokenStandard: alchemyNft.id.tokenMetadata.tokenType as TokenStandard
      };
    });
  }
}
