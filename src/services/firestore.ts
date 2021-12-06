import { fstrCnstnts } from '@constants';
import firebaseAdmin from 'firebase-admin';

const serviceAccount = require('../../creds/nftc-dev-firebase-creds.json');

firebaseAdmin.initializeApp({
  // @ts-ignore
  credential: firebaseAdmin.credential.cert(serviceAccount)
});

export function getFirebaseAdmin() {
  return firebaseAdmin;
}

const db = firebaseAdmin.firestore();

export async function isTokenVerified(address: string) {
  const tokenAddress = address.trim().toLowerCase();
  const doc = await db.collection(fstrCnstnts.ALL_COLLECTIONS_COLL).doc(tokenAddress).get();
  if (doc.exists) {
    const hasBlueCheck = doc.get('hasBlueCheck');
    if (hasBlueCheck) {
      return true;
    }
  }
  return false;
}

export async function hasBonusReward(address: string) {
  const doc = await db
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.BONUS_REWARD_TOKENS_COLL)
    .doc(address)
    .get();
  return doc.exists;
}
