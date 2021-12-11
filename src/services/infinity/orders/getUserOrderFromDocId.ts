import { OrderSide } from '@base/types/NftInterface';
import { fstrCnstnts } from '@constants';
import { getUserInfoRef } from '../users/getUser';

export function getUserOrderRefFromDocId(userAddress: string, docId: string, orderSide: OrderSide) {
  const userRef = getUserInfoRef(userAddress);
  const collection = orderSide === OrderSide.Buy ? fstrCnstnts.OFFERS_COLL : fstrCnstnts.LISTINGS_COLL;
  return userRef.collection(collection).doc(docId);
}

export async function getUserOrdersFromDocId(userAddress: string, docId: string, orderSide: OrderSide) {
  const orderDoc = await getUserOrderRefFromDocId(userAddress, docId, orderSide).get();
  if (orderDoc.exists) {
    const order = orderDoc.data();
    order.id = orderDoc.id;
    return [order];
  }
  return [];
}
