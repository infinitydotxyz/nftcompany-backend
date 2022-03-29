import { ChainId, Collection } from '@infinityxyz/lib/types/core';
import { trimLowerCase } from '@infinityxyz/lib/utils';
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { FirebaseService } from 'firebase/firebase.service';

export type ParsedCollectionId = {
  address: string;
  chainId: ChainId;
  ref: FirebaseFirestore.DocumentReference<Collection>;
};

@Injectable()
export class ParseCollectionIdPipe
  implements
    PipeTransform<
      string,
      Promise<{ address: string; chainId: ChainId; ref: FirebaseFirestore.DocumentReference<Collection> }>
    >
{
  constructor(private firebaseService: FirebaseService) {}

  async transform(value: string): Promise<{
    address: string;
    chainId: ChainId;
    ref: FirebaseFirestore.DocumentReference<Collection>;
  }> {
    const [chainIdOrSlug, address] = value.split(':').map((item) => trimLowerCase(item));
    let chainId, slug;
    if (address) {
      chainId = chainIdOrSlug;
    } else {
      slug = chainIdOrSlug;

      if (!slug) {
        throw new BadRequestException('Invalid slug');
      }
    }

    const collectionRef = (await this.firebaseService.getCollectionRef({
      chainId,
      slug,
      address
    })) as FirebaseFirestore.DocumentReference<Collection>;

    const [chainIdFromRef, addressFromRef] = collectionRef.id.split(':');

    if (!Object.values(ChainId).includes(chainIdFromRef as any)) {
      throw new BadRequestException('Invalid chain id');
    }

    return {
      address: addressFromRef,
      chainId: chainIdFromRef as ChainId,
      ref: collectionRef
    };
  }
}
