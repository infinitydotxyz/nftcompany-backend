import { firestore } from '../../../container';
import firebaseAdmin from 'firebase-admin';
import { fstrCnstnts } from '../../../constants';
import { Twitter } from '../../../services/twitter/Twitter';

export async function getFeedTweets() {
  const twitterClient = new Twitter();
  const tweets = await twitterClient.getUserTweets('0N1Force');

  if (tweets && tweets?.length > 0) {
    for (let i = 0; i < 2; i++) {
      const data = {
        id: tweets[i]?.id,
        collectionAddress: '0xa1',
        likes: 1,
        title: tweets[i]?.text,
        type: 'TWEET',
        datetime: firebaseAdmin.firestore.FieldValue.serverTimestamp()
      };
      await saveFeedEvent(data);
    }
  }
}

export async function saveFeedEvent(data: any) {
  try {
    await firestore.collection('feed/data/events').doc(data?.id).set(data, { merge: true });
    return { success: true };
  } catch (err) {
    return {
      successs: false,
      error: err
    };
  }
}
