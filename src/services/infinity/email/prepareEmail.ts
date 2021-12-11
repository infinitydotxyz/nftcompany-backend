import { firestore } from '@base/container';
import { fstrCnstnts, SITE_BASE } from '@constants';
import { error, log } from '@utils/logger';
import { getEmptyUserProfileInfo } from '../users/getUserReward';
import { sendEmail } from './sendEmail';

// right now emails are sent when an item is purchased, offer is made or an offer is accepted
export async function prepareEmail(user: any, order: any, type: any) {
  log('Preparing to send email to user', user, 'for action type', type);
  const userDoc = await firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(user)
    .get();

  let profileInfo = getEmptyUserProfileInfo();

  if (userDoc.data()) {
    profileInfo = {
      ...profileInfo,
      ...userDoc.data().profileInfo
    };
  }

  const email = profileInfo.email.address;
  const verified = profileInfo.email.verified;
  const subscribed = profileInfo.email.subscribed;
  if (!email || !verified || !subscribed) {
    log('Not sending email as it is not verfied or subscribed or not found');
    return;
  }

  const price = order.metadata.basePriceInEth;

  let subject = '';
  let link = SITE_BASE;
  if (type === 'offerMade') {
    subject = 'You received a ' + price + ' ETH offer at Infinity';
    link += '/offers-received';
  } else if (type === 'offerAccepted') {
    subject = 'Your offer of ' + price + ' ETH has been accepted at Infinity';
    link += '/purchases';
  } else if (type === 'itemPurchased') {
    subject = 'Your item has been purchased for ' + price + ' ETH at Infinity';
    link += '/sales';
  } else {
    error('Cannot prepare email for unknown action type');
    return;
  }

  const html = '<p>See it here:</p> ' + '<a href=' + link + ' target="_blank">' + link + '</a>';
  // send email
  sendEmail(email, subject, html);
}
