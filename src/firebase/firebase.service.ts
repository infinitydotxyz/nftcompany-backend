import { Collection } from '@infinityxyz/lib/types/core/Collection';
import { firestoreConstants, getCollectionDocId } from '@infinityxyz/lib/utils';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { FB_STORAGE_BUCKET } from '../constants';
import firebaseAdmin, { storage } from 'firebase-admin';
import { CollectionRefDto } from './dto/collection-ref.dto';
import { FIREBASE_OPTIONS } from './firebase.constants';
import { FirebaseModuleOptions } from './firebase.types';

@Injectable()
export class FirebaseService {
  private readonly _firestore: FirebaseFirestore.Firestore;
  public readonly firestoreNamespace = firebaseAdmin.firestore;

  public static readonly DEFAULT_ITEMS_PER_PAGE = 50;

  public get firestore() {
    return this._firestore;
  }

  public get bucket() {
    return storage().bucket();
  }

  constructor(@Inject(FIREBASE_OPTIONS) private options: FirebaseModuleOptions) {
    if ((options.isTest && firebaseAdmin.apps.length == 0) || !options.isTest) {
      firebaseAdmin.initializeApp(
        {
          credential: firebaseAdmin.credential.cert(options.cert),
          storageBucket: FB_STORAGE_BUCKET
        },
        options.certName
      );
    }
    this._firestore = firebaseAdmin.firestore();
  }

  /**
   * Get a reference to a collection via a address + chainId or slug
   */
  async getCollectionRef(
    collectionRefProps: CollectionRefDto
  ): Promise<FirebaseFirestore.DocumentReference<Partial<Collection>>> {
    if ('slug' in collectionRefProps && collectionRefProps?.slug) {
      const docQuery = this.firestore
        .collection(firestoreConstants.COLLECTIONS_COLL)
        .where('slug', '==', collectionRefProps.slug)
        .select('address', 'chainId', 'slug');

      const results = await docQuery.get();
      const doc = results.docs?.[0];
      if (!doc?.exists) {
        throw new NotFoundException('Failed to find collection via slug');
      }
      return doc.ref;
    } else if ('address' in collectionRefProps && collectionRefProps?.address && collectionRefProps?.chainId) {
      const docId = getCollectionDocId({
        collectionAddress: collectionRefProps.address,
        chainId: collectionRefProps.chainId
      });

      return this.firestore.collection(firestoreConstants.COLLECTIONS_COLL).doc(docId);
    } else {
      throw new BadRequestException(`Failed to provide a collection slug or address`);
    }
  }
}
