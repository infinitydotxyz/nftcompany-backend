import { singleton } from 'tsyringe';
import firebaseAdmin from 'firebase-admin';
import { Bucket, File } from '@google-cloud/storage';
import crypto from 'crypto';
import serviceAccount from '../../creds/nftc-dev-firebase-creds.json';
import { FB_STORAGE_BUCKET } from '../constants';
import { Readable } from 'stream';
import { error, log } from '@utils/logger';

@singleton()
export default class Firestore {
  db: FirebaseFirestore.Firestore;

  firebaseAdmin: firebaseAdmin.app.App;

  bucket: Bucket;

  constructor() {
    firebaseAdmin.initializeApp({
      // @ts-expect-error
      credential: firebaseAdmin.credential.cert(serviceAccount),
      storageBucket: FB_STORAGE_BUCKET
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

  getStaleListingDocId({
    tokenAddress,
    tokenId,
    basePrice,
    listingTime
  }: {
    tokenAddress: string;
    tokenId: string;
    basePrice: string;
    listingTime: number;
  }) {
    const data = `${tokenAddress.trim().toLowerCase()}${tokenId.trim()}${basePrice}${listingTime}`;
    return crypto.createHash('sha256').update(data).digest('hex').trim().toLowerCase();
  }

  getAssetDocId({ chainId, tokenId, tokenAddress }: { chainId: string; tokenId: string; tokenAddress: string }) {
    const data = tokenAddress.trim() + tokenId.trim() + chainId;
    return crypto.createHash('sha256').update(data).digest('hex').trim().toLowerCase();
  }

  getHistoricalDocId(year: number, week: number) {
    return `${year}-${week}`;
  }

  async uploadBuffer(buffer: Buffer, path: string, contentType: string): Promise<File> {
    const remoteFile = this.bucket.file(path);

    // no idea why exists() returns an array [boolean]
    const existsArray = await remoteFile.exists();
    if (existsArray && existsArray.length > 0 && !existsArray[0]) {
      return await new Promise<File>((resolve, reject) => {
        Readable.from(buffer).pipe(
          remoteFile
            .createWriteStream({
              metadata: {
                contentType
              }
            })
            .on('error', (err) => {
              error(err);

              reject(err);
            })
            .on('finish', () => {
              log(`uploaded: ${remoteFile.name}`);

              resolve(remoteFile);
            })
        );
      });
    }

    return remoteFile;
  }
}
