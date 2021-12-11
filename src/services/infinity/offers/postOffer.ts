import { firestore } from '@base/container';
import { fstrCnstnts } from '@constants';
import { log } from '@utils/logger';
import { prepareEmail } from '../email/prepareEmail';
import { updateNumOrders } from '../orders/updateNumOrders';

export async function postOffer(maker: string, payload: any, batch: any, numOrders: number, hasBonus: boolean) {
  log('Writing offer to firestore for user', maker);
  const taker = payload.metadata.asset.owner.trim().toLowerCase();
  const { basePrice } = payload;
  const tokenAddress = payload.metadata.asset.address.trim().toLowerCase();
  const tokenId = payload.metadata.asset.id.trim();
  payload.metadata.createdAt = Date.now();

  // store data in offers of maker
  const offerRef = firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(maker)
    .collection(fstrCnstnts.OFFERS_COLL)
    .doc(firestore.getDocId({ tokenAddress, tokenId, basePrice }));
  batch.set(offerRef, payload, { merge: true });

  log('updating num offers since offer does not exist');
  // update num user offers made
  updateNumOrders(batch, maker, numOrders, hasBonus, 0);

  // send email to taker that an offer is made
  prepareEmail(taker, payload, 'offerMade');
}
