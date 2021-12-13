import { singleton } from 'tsyringe';
import firebaseAdmin from 'firebase-admin';
import { Bucket } from '@google-cloud/storage';
import crypto from 'crypto';
import serviceAccount from '../../creds/nftc-dev-firebase-creds.json';

@singleton()
export default class Firestore {
  db: FirebaseFirestore.Firestore;

  firebaseAdmin: firebaseAdmin.app.App;

  bucket: Bucket;

  constructor() {
    firebaseAdmin.initializeApp({
      // @ts-ignore
      credential: firebaseAdmin.credential.cert(serviceAccount),
      storageBucket: process.env.firebaseStorageBucket
    });
    this.db = firebaseAdmin.firestore();
    this.bucket = firebaseAdmin.storage().bucket();
  }

  collection(collectionPath: string) {
    return this.db.collection(collectionPath);
  }

  // eslint-disable-next-line no-unused-vars
  getDocId({ tokenAddress, tokenId, basePrice }: { tokenAddress: string; tokenId: string; basePrice: string }) {
    const data = tokenAddress.trim() + tokenId.trim() + basePrice;
    return crypto.createHash('sha256').update(data).digest('hex').trim().toLowerCase();
  }

  getAssetDocId({ chainId, tokenId, tokenAddress }: { chainId: string; tokenId: string; tokenAddress: string }) {
    const data = tokenAddress.trim() + tokenId.trim() + chainId;
    return crypto.createHash('sha256').update(data).digest('hex').trim().toLowerCase();
  }
}
