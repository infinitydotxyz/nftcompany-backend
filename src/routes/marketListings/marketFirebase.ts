import { MarketListIdType, OBOrder } from '@infinityxyz/lib/types/core';
import { isOrderExpired, orderHash } from '@infinityxyz/lib/utils';
import { firestore } from 'container';
import { docsToArray } from 'utils/formatters';
import { fstrCnstnts } from '../../constants';

export interface ExpiredCacheItem {
  listId: MarketListIdType;
  order: OBOrder;
}

interface SellOrderSave extends OBOrder {
  collectionAddresses: string[];
}

export const deleteOrder = async (isBuyOrder: boolean, listId: MarketListIdType, orderId: string): Promise<void> => {
  if (orderId) {
    const collection = await firestore.db
      .collection(isBuyOrder ? fstrCnstnts.BUY_ORDERS_COLL : fstrCnstnts.SELL_ORDERS_COLL)
      .doc(listId)
      .collection('orders');

    const doc = collection.doc(orderId);

    await doc.delete();
  } else {
    console.log('_deleteOrder, id is blank');
  }
};

export const moveOrder = async (
  order: OBOrder,
  fromListId: MarketListIdType,
  toListId: MarketListIdType
): Promise<void> => {
  if (toListId && fromListId) {
    if (!order.isSellOrder) {
      await addBuyOrder(toListId, order);

      await deleteBuyOrder(fromListId, order.id ?? '');
    } else {
      await addSellOrder(toListId, order);

      await deleteSellOrder(fromListId, order.id ?? '');
    }
  } else {
    console.log('delete failed, toListId || fromListId is blank');
  }
};

// ===============================================================
// Buy orders

export const buyOrders = async (listId: MarketListIdType): Promise<OBOrder[]> => {
  const orders = await buyOrderMap(listId);

  return Array.from(orders.values());
};

export const buyOrderMap = async (listId: MarketListIdType): Promise<Map<string, OBOrder>> => {
  const result = await firestore.db.collection(fstrCnstnts.BUY_ORDERS_COLL).doc(listId).collection('orders').get();
  if (result.docs) {
    const { results } = docsToArray(result.docs);

    const map: Map<string, OBOrder> = new Map();

    for (const order of results) {
      map.set(order.id, order);
    }

    return map;
  }

  return new Map<string, OBOrder>();
};

export const addBuyOrder = async (listId: MarketListIdType, buyOrder: OBOrder): Promise<void> => {
  const c = await buyOrderMap(listId);

  if (!c.has(orderHash(buyOrder))) {
    await saveBuyOrder(listId, buyOrder);
  } else {
    console.log(`addBuyOrder already exists ${orderHash(buyOrder)} ${listId}`);
  }
};

export const deleteBuyOrder = async (listId: MarketListIdType, orderId: string): Promise<void> => {
  const c = await buyOrderMap(listId);

  if (c.has(orderId)) {
    await deleteOrder(true, listId, orderId);
  } else {
    console.log(`deleteBuyOrder order not found ${orderId} ${listId}`);
  }
};

export const saveBuyOrder = async (listId: MarketListIdType, buyOrder: OBOrder): Promise<OBOrder> => {
  const collection = await firestore.db.collection(fstrCnstnts.BUY_ORDERS_COLL).doc(listId).collection('orders');

  // Set id to hash
  buyOrder.id = orderHash(buyOrder);

  const doc = collection.doc(buyOrder.id);
  await doc.set(buyOrder);

  return (await doc.get()).data() as OBOrder;
};

// ===============================================================
// Sell orders

export const sellOrders = async (listId: MarketListIdType): Promise<OBOrder[]> => {
  const orders = await sellOrderMap(listId);

  return Array.from(orders.values());
};

export const sellOrderMap = async (listId: MarketListIdType): Promise<Map<string, OBOrder>> => {
  const result = await firestore.db.collection(fstrCnstnts.SELL_ORDERS_COLL).doc(listId).collection('orders').get();
  if (result.docs) {
    const { results } = docsToArray(result.docs);

    const map: Map<string, OBOrder> = new Map();

    for (const order of results) {
      map.set(order.id, order);
    }

    return map;
  }

  return new Map<string, OBOrder>();
};

export const sellOrdersWithParams = async (
  listId: MarketListIdType,
  collectionAddresses: string[]
): Promise<OBOrder[]> => {
  const result = await firestore.db
    .collection(fstrCnstnts.SELL_ORDERS_COLL)
    .doc(listId)
    .collection('orders')
    // CollectionAddresses is added on save, it's not part of the OBOrder
    .where('collectionAddresses', 'array-contains-any', collectionAddresses)
    .get();

  if (result.docs) {
    const { results } = docsToArray(result.docs);

    return results;
  }

  return [];
};

export const addSellOrder = async (listId: MarketListIdType, sellOrder: OBOrder): Promise<void> => {
  const c = await sellOrderMap(listId);

  if (!c.has(orderHash(sellOrder))) {
    await saveSellOrder(listId, sellOrder);
  } else {
    console.log(`deleteBuyOrder order not found ${orderHash(sellOrder)} ${listId}`);
  }
};

export const deleteSellOrder = async (listId: MarketListIdType, orderId: string): Promise<void> => {
  const c = await sellOrderMap(listId);

  if (c.has(orderId)) {
    await deleteOrder(false, listId, orderId);
  } else {
    console.log(`deleteSellOrder order not found ${orderId} ${listId}`);
  }
};

export const saveSellOrder = async (listId: MarketListIdType, sellOrder: OBOrder): Promise<OBOrder> => {
  const collection = await firestore.db.collection(fstrCnstnts.SELL_ORDERS_COLL).doc(listId).collection('orders');

  // Set id to hash
  sellOrder.id = orderHash(sellOrder);

  // Add collectionAddresses which is used for queries
  const collectionAddresses: string[] = [];
  for (const nft of sellOrder.nfts) {
    collectionAddresses.push(nft.collection);
  }
  const saveOrder = sellOrder as SellOrderSave;
  saveOrder.collectionAddresses = collectionAddresses;

  const doc = collection.doc(saveOrder.id);
  await doc.set(saveOrder);

  return (await doc.get()).data() as OBOrder;
};

// ===============================================================
// Expired orders

export const expiredOrders = async (): Promise<ExpiredCacheItem[]> => {
  const result: ExpiredCacheItem[] = [];

  result.push(...(await expiredBuyOrders('validActive')));
  result.push(...(await expiredBuyOrders('validInactive')));
  // Result.push(...(await expiredBuyOrders('invalid')));

  result.push(...(await expiredSellOrders('validActive')));
  result.push(...(await expiredSellOrders('validInactive')));
  // Result.push(...(await expiredSellOrders('invalid')));

  return result;
};

export const expiredBuyOrders = async (listId: MarketListIdType): Promise<ExpiredCacheItem[]> => {
  const result: ExpiredCacheItem[] = [];

  const orders = await buyOrders(listId);
  for (const order of orders) {
    if (isOrderExpired(order)) {
      result.push({ listId: listId, order: order });
    }
  }

  return result;
};

export const expiredSellOrders = async (listId: MarketListIdType): Promise<ExpiredCacheItem[]> => {
  const result: ExpiredCacheItem[] = [];

  const orders = await sellOrders(listId);
  for (const order of orders) {
    if (isOrderExpired(order)) {
      result.push({ listId: listId, order: order });
    }
  }

  return result;
};
