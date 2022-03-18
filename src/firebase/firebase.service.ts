import { Inject, Injectable } from '@nestjs/common';
import firebaseAdmin from 'firebase-admin';
import { FIREBASE_OPTIONS } from './firebase.constants';
import { FirebaseModuleOptions } from './firebase.types';

@Injectable()
export class FirebaseService {
  firestore: FirebaseFirestore.Firestore;

  constructor(@Inject(FIREBASE_OPTIONS) private options: FirebaseModuleOptions) {
    firebaseAdmin.initializeApp(
      {
        credential: firebaseAdmin.credential.cert(options.cert)
      },
      options.certName
    );
    this.firestore = firebaseAdmin.firestore();
  }
}
