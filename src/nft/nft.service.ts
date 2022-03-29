import { CreationFlow } from '@infinityxyz/lib/types/core';
import { firestoreConstants, getCollectionDocId } from '@infinityxyz/lib/utils';
import { Injectable, NotFoundException } from '@nestjs/common';
import CollectionService from 'collection/collection.service';
import { CollectionDto } from 'collection/dto/collection.dto';
import { FirebaseService } from 'firebase/firebase.service';
import { NftQueryDto } from './dto/nft-query.dto';
import { NftDto } from './dto/nft.dto';

@Injectable()
export class NftService {
  constructor(private firebaseService: FirebaseService, private collectionService: CollectionService) {}

  async getNft(nftQuery: NftQueryDto): Promise<NftDto> {
    const collection: CollectionDto = await this.collectionService.getCollectionBySlugOrAddress(nftQuery);

    const collectionDocId = getCollectionDocId({ collectionAddress: collection.address, chainId: collection.chainId });

    if (collection?.state?.create?.step !== CreationFlow.Complete || !collectionDocId) {
      throw new NotFoundException(
        `Failed to find collection with address: ${nftQuery.address} and chainId: ${nftQuery.chainId}`
      );
    }

    const nftDocRef = this.firebaseService.firestore
      .collection(firestoreConstants.COLLECTIONS_COLL)
      .doc(collectionDocId)
      .collection(firestoreConstants.COLLECTION_NFTS_COLL)
      .doc(nftQuery.tokenId);

    const nftSnapshot = await nftDocRef.get();

    const nft = nftSnapshot.data() as NftDto | undefined;

    if (!nft) {
      throw new NotFoundException(`Failed to find nft with tokenId: ${nftQuery.tokenId}`);
    }

    return nft;
  }
}
