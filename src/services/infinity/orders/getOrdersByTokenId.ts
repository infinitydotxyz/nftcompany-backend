import { firestore } from '@base/container';
import { OrderDirection } from '@infinityxyz/types/core';
import { fstrCnstnts } from '@base/constants';

export async function getOrdersByTokenId(tokenAddress: string, tokenId: string, limit: number) {
  let query = firestore.db.collectionGroup(fstrCnstnts.OFFERS_COLL).where('metadata.asset.address', '==', tokenAddress);
  if (tokenId) {
    query = query.where('metadata.asset.id', '==', tokenId);
  }
  query = query.orderBy('metadata.basePriceInEth', OrderDirection.Descending).limit(limit);

  const snapshot = await query.get();

  const assetEvents: any[] = [];
  for (const offer of snapshot.docs) {
    const order = offer.data();
    const obj = {
      asset: {
        token_id: order.metadata.asset.id,
        image_thumbnail_url: order.metadata.asset.image,
        name: order.metadata.asset.title
      },
      created_date: order.listingTime * 1000,
      from_account: {
        address: order.maker
      },
      chainId: order.metadata.chainId,
      bid_amount: order.base_price,
      offerSource: 'Infinity'
    };
    assetEvents.push(obj);
  }

  return assetEvents;
}
