import { firestoreConstants } from '@infinityxyz/lib/utils';
import { Injectable } from '@nestjs/common';
import { FirebaseService } from 'firebase/firebase.service';
import { AssetQueryDto } from './dto/asset-query.dto';

@Injectable()
export class AssetService {
  constructor(private firebaseService: FirebaseService) {}

  async getAsset(assetQuery: AssetQueryDto): Promise<any> {
    const collectionDocRef = await this.firebaseService.getCollectionRef(assetQuery as any);

    const nftRef = await collectionDocRef.collection(firestoreConstants.COLLECTION_NFTS_COLL).doc(assetQuery.tokenId);
    const nftSnapshot = await nftRef.get();

    return nftSnapshot.data();
  }
}
