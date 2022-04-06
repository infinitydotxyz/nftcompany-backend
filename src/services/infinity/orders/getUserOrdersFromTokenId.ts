import { OrderSide } from '@infinityxyz/lib/types/core';
import { firestoreConstants, log } from '@infinityxyz/lib/utils';
import { getUserInfoRef } from '../users/getUser';

export async function getUserOrdersFromTokenId(
  userAddress: string,
  tokenAddress: string,
  tokenId: string,
  side: OrderSide
) {
  log('Fetching order for', userAddress, tokenAddress, tokenId, side);

  const collection = side === OrderSide.Buy ? firestoreConstants.OFFERS_COLL : firestoreConstants.LISTINGS_COLL;

  const results = await getUserInfoRef(userAddress)
    .collection(collection)
    .where('metadata.asset.address', '==', tokenAddress)
    .where('metadata.asset.id', '==', tokenId)
    .where('side', '==', side)
    .get();

  if (results.empty) {
    log('No matching orders');
    return [];
  }

  const orders: any[] = [];
  for (const doc of results.docs) {
    const order = doc.data();
    order.id = doc.id;
    orders.push(order);
  }

  return orders;
}
