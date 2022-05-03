// import { ChainId } from "@infinityxyz/lib/types/core";
// import { Injectable, PipeTransform } from "@nestjs/common";
// import { NftDto } from "collections/nfts/dto/nft.dto";
// import { NftsService } from "collections/nfts/nfts.service";
// import { MnemonicUserNft } from "./mnemonic.types";

// @Injectable()
// export class MnemonicNftToInfinityNft implements PipeTransform<{ mnemonicNft: MnemonicUserNft }, Promise<NftDto | null>> {
//     constructor(private nftsService: NftsService) {}

//     async transform({mnemonicNft}: {mnemonicNft: MnemonicUserNft}): Promise<NftDto | null> {
//         const tokenId = mnemonicNft.tokenId;
//         const chainId = ChainId.Mainnet;
//         const nft = await this.nftsService.getNft({
//             address: mnemonicNft.contractAddress,
//             chainId,
//             tokenId,
//         });

//     return {
//       address: mnemonicNft.contractAddress,
//       chainId,
//       slug: nft?.slug ?? '',
//       tokenId: tokenId,
//       minter: nft?.minter ?? '',
//       mintedAt: nft?.mintedAt ?? NaN,
//       mintTxHash: nft?.mintTxHash ?? '',
//       mintPrice: nft?.mintPrice ?? NaN,
//       metadata: ,
//       numTraitTypes: nft?.numTraitTypes ?? metadata?.attributes?.length ?? 0,
//       updatedAt: nft?.updatedAt ?? NaN,
//       tokenUri: nft?.tokenUri ?? alchemyNft.tokenUri?.raw ?? '',
//       rarityRank: nft?.rarityRank ?? NaN,
//       rarityScore: nft?.rarityScore ?? NaN,
//       image: {
//         url: (nft?.image?.url || alchemyNft?.media?.[0]?.gateway || alchemyNft?.metadata?.image) ?? '',
//         originalUrl: (nft?.image?.originalUrl || alchemyNft?.media?.[0]?.raw || alchemyNft?.metadata?.image) ?? '',
//         updatedAt: nft?.image?.updatedAt ?? NaN
//       },
//       state: nft?.state ?? undefined,
//       tokenStandard: alchemyNft.id.tokenMetadata.tokenType as TokenStandard
//     };
//     }
