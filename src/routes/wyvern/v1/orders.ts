import { firestore } from '@base/container';
import { OrderSide } from '@base/types/NftInterface';
import { StatusCode } from '@base/types/StatusCode';
import { fstrCnstnts } from '@constants';
import { error, log } from '@utils/logger';
import { Router } from 'express';
import { stringify } from 'querystring';
const router = Router();

// fetch order to fulfill
router.get('/wyvern/v1/orders', async (req, res) => {
  const { maker, id, side, tokenAddress, tokenId } = req.query;
  let docId;

  if (id) {
    // @ts-ignore
    docId = id.trim(); // preserve case
  }

  try {
    const infinityResponse = await getInfinityOrders({
      maker: maker as string,
      docId,
      side: side as string,
      tokenAddress: tokenAddress as string,
      tokenId: tokenId as string
    });
    if (infinityResponse.error) {
      log(`Fetching orders failed`);
      res.sendStatus(infinityResponse.error);
      return;
    }
    const infinityCount = infinityResponse?.result?.count || 0;
    const infinityOrders = infinityResponse?.result?.orders || [];

    const result = {
      count: infinityCount,
      orders: infinityOrders
    };

    res.send(result);
  } catch (err) {
    log('Error while fetching orders');
    error(err);
    res.sendStatus(StatusCode.InternalServerError);
  }
});

export async function getInfinityOrders({
  maker,
  docId,
  side,
  tokenAddress,
  tokenId
}: {
  maker: string;
  docId: string;
  side: string;
  tokenAddress: string;
  tokenId: string;
}) {
  if (docId?.length > 0) {
    return getOrdersWithDocId({ maker, id: docId, side });
  }

  return getOrdersWithTokenId({ maker, tokenAddress, tokenId, side });
}

const getOrdersWithDocId = async ({ maker, id, side }: { maker: string; id: string; side: string }) => {
  if (!maker || !id || !side || (side !== OrderSide.Buy.toString() && side !== OrderSide.Sell.toString())) {
    error('Invalid input');
    return { error: StatusCode.BadRequest };
  }

  const makerStr = maker.trim().toLowerCase();
  const docId = id.trim(); // preserve case
  const sideStr = side;
  let collection = fstrCnstnts.LISTINGS_COLL;
  try {
    if (sideStr === OrderSide.Buy.toString()) {
      collection = fstrCnstnts.OFFERS_COLL;
    }
    const doc = await firestore
      .collection(fstrCnstnts.ROOT_COLL)
      .doc(fstrCnstnts.INFO_DOC)
      .collection(fstrCnstnts.USERS_COLL)
      .doc(makerStr)
      .collection(collection)
      .doc(docId)
      .get();

    if (doc.exists) {
      const orders = [];
      const order = doc.data();
      order.id = doc.id;
      orders.push(order);
      const resp = {
        count: orders.length,
        orders: orders
      };
      return { result: resp };
    } else {
      return { error: StatusCode.NotFound };
    }
  } catch (err) {
    error('Error fetching order: ' + docId + ' for user ' + makerStr + ' from collection ' + collection);
    error(err);
    return { error: StatusCode.InternalServerError };
  }
};

const getOrdersWithTokenId = async ({
  maker,
  tokenAddress,
  tokenId,
  side
}: {
  maker: string;
  tokenAddress: string;
  tokenId: string;
  side: string;
}) => {
  if (
    !maker ||
    !tokenAddress ||
    !tokenId ||
    (side !== OrderSide.Buy.toString() && side !== OrderSide.Sell.toString())
  ) {
    error('Invalid input');

    return { error: StatusCode.BadRequest };
  }

  const makerStr = maker.trim().toLowerCase();
  const tokenAddressStr = tokenAddress.trim().toLowerCase();

  const docs = await getOrders(makerStr, tokenAddressStr, tokenId, +side);
  if (docs) {
    const orders = [];
    for (const doc of docs) {
      const order = doc.data();
      order.id = doc.id;
      orders.push(order);
    }
    const resp = {
      count: orders.length,
      orders: orders
    };
    return { result: resp };
  }

  return {
    error: StatusCode.NotFound
  };
};

export async function getOrders(maker: string, tokenAddress: string, tokenId: string, side: OrderSide) {
  log('Fetching order for', maker, tokenAddress, tokenId, side);

  let collection = fstrCnstnts.LISTINGS_COLL;
  if (side === OrderSide.Buy) {
    collection = fstrCnstnts.OFFERS_COLL;
  }
  const results = await firestore
    .collection(fstrCnstnts.ROOT_COLL)
    .doc(fstrCnstnts.INFO_DOC)
    .collection(fstrCnstnts.USERS_COLL)
    .doc(maker)
    .collection(collection)
    .where('metadata.asset.address', '==', tokenAddress)
    .where('metadata.asset.id', '==', tokenId)
    .where('side', '==', side)
    .get();

  if (results.empty) {
    log('No matching orders');
    return [];
  }
  return results.docs;
}

export default router;
