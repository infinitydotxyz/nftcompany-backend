import { ConfigServiceType, ServiceAccountNames } from 'app.module';
import firebaseAdmin from 'firebase-admin';

/**
 * base class to handle initializing a firebase connection
 * provides access to the firebase admin instance
 * provides basic utilities
 */
export default class FirebaseBaseProvider {
  firebaseAdmin: firebaseAdmin.app.App;

  constructor(protected configService: ConfigServiceType, name: ServiceAccountNames) {
    const FirebaseServiceAccount = this.configService.get(name);
    firebaseAdmin.initializeApp(
      {
        credential: firebaseAdmin.credential.cert(FirebaseServiceAccount)
      },
      name
    );
  }
}
