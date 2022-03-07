import { OrderSide } from '@infinityxyz/types/core';
import { fstrCnstnts } from '../../../constants';
import { log } from 'utils/logger';
import { getUserInfoRef } from '../users/getUser';

export async function getUserOrdersFromTokenId(
  userAddress: string,
  tokenAddress: string,
  tokenId: string,
  side: OrderSide
) {
  log('Fetching order for', userAddress, tokenAddress, tokenId, side);

  const collection = side === OrderSide.Buy ? fstrCnstnts.OFFERS_COLL : fstrCnstnts.LISTINGS_COLL;

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
