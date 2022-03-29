import { firestoreConstants } from '@infinityxyz/lib/utils';
import { Injectable } from '@nestjs/common';
import { FirebaseService } from 'firebase/firebase.service';
import { NftQueryDto } from './dto/nft-query.dto';

@Injectable()
export class NftService {
  constructor(private firebaseService: FirebaseService) {}

  async getNft(nftQuery: NftQueryDto) {
    const collectionDocRef = await this.firebaseService.getCollectionRef(nftQuery as any);

    const nftDocRef = collectionDocRef.collection(firestoreConstants.COLLECTION_NFTS_COLL).doc(nftQuery.tokenId);

    const [nftSnapshot, collectionSnapshot] = await Promise.all([nftDocRef.get(), collectionDocRef.get()]);

    return nftSnapshot.data();
  }
}
