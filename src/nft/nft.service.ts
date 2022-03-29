import { firestoreConstants } from '@infinityxyz/lib/utils';
import { Injectable } from '@nestjs/common';
import { FirebaseService } from 'firebase/firebase.service';
import { NftQueryDto } from './dto/nft-query.dto';

@Injectable()
export class NftService {
  constructor(private firebaseService: FirebaseService) {}

  async getNft(nftQuery: NftQueryDto) {
    const collectionDocRef = await this.firebaseService.getCollectionRef(nftQuery as any);

    const nftRef = await collectionDocRef.collection(firestoreConstants.COLLECTION_NFTS_COLL).doc(nftQuery.tokenId);

    const nftSnapshot = await nftRef.get();

    return nftSnapshot.data();
  }
}
