import { singleton } from 'tsyringe';
import firebaseAdmin from 'firebase-admin';

const serviceAccount = require('../../creds/nftc-dev-firebase-creds.json');

@singleton()
export default class Firestore {
  db: FirebaseFirestore.Firestore;

  constructor() {
    firebaseAdmin.initializeApp({
      // @ts-ignore
      credential: firebaseAdmin.credential.cert(serviceAccount)
    });
    this.db = firebaseAdmin.firestore();
  }

  collection(collectionPath: string) {
    return this.db.collection(collectionPath);
  }
}
