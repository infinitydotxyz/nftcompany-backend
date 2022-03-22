import {
  BuyOrder,
  isBuyOrder,
  isOrderExpired,
  MarketListIdType,
  MarketOrder,
  orderHash,
  SellOrder
} from '@infinityxyz/lib/types/core';
import { firestore } from 'container';
import { docsToArray } from 'utils/formatters';
import { fstrCnstnts } from '../../constants';

export interface ExpiredCacheItem {
  listId: MarketListIdType;
  order: MarketOrder;
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
  order: MarketOrder,
  fromListId: MarketListIdType,
  toListId: MarketListIdType
): Promise<void> => {
  if (toListId && fromListId) {
    if (isBuyOrder(order)) {
      await addBuyOrder(toListId, order);

      await deleteBuyOrder(fromListId, order.id ?? '');
    } else {
      await addSellOrder(toListId, order as SellOrder);

      await deleteSellOrder(fromListId, order.id ?? '');
    }
  } else {
    console.log('delete failed, toListId || fromListId is blank');
  }
};

// ===============================================================
// buy orders

export const buyOrders = async (listId: MarketListIdType): Promise<BuyOrder[]> => {
  const orders = await buyOrderMap(listId);

  return Array.from(orders.values());
};

export const buyOrderMap = async (listId: MarketListIdType): Promise<Map<string, BuyOrder>> => {
  const result = await firestore.db.collection(fstrCnstnts.BUY_ORDERS_COLL).doc(listId).collection('orders').get();
  if (result.docs) {
    const { results } = docsToArray(result.docs);

    const map: Map<string, BuyOrder> = new Map();

    for (const order of results) {
      map.set(order.id, order);
    }

    return map;
  }

  return new Map<string, BuyOrder>();
};

export const addBuyOrder = async (listId: MarketListIdType, buyOrder: BuyOrder): Promise<void> => {
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

export const saveBuyOrder = async (listId: MarketListIdType, buyOrder: BuyOrder): Promise<BuyOrder> => {
  const collection = await firestore.db.collection(fstrCnstnts.BUY_ORDERS_COLL).doc(listId).collection('orders');

  // set id to hash
  buyOrder.id = orderHash(buyOrder);

  const doc = collection.doc(buyOrder.id);
  await doc.set(buyOrder);

  return (await doc.get()).data() as BuyOrder;
};

// ===============================================================
// sell orders

export const sellOrders = async (listId: MarketListIdType): Promise<SellOrder[]> => {
  const orders = await sellOrderMap(listId);

  return Array.from(orders.values());
};

export const sellOrderMap = async (listId: MarketListIdType): Promise<Map<string, SellOrder>> => {
  const result = await firestore.db.collection(fstrCnstnts.SELL_ORDERS_COLL).doc(listId).collection('orders').get();
  if (result.docs) {
    const { results } = docsToArray(result.docs);

    const map: Map<string, SellOrder> = new Map();

    for (const order of results) {
      map.set(order.id, order);
    }

    return map;
  }

  return new Map<string, SellOrder>();
};

export const addSellOrder = async (listId: MarketListIdType, sellOrder: SellOrder): Promise<void> => {
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

export const saveSellOrder = async (listId: MarketListIdType, sellOrder: SellOrder): Promise<SellOrder> => {
  const collection = await firestore.db.collection(fstrCnstnts.SELL_ORDERS_COLL).doc(listId).collection('orders');

  // set id to hash
  sellOrder.id = orderHash(sellOrder);

  const doc = collection.doc(sellOrder.id);
  await doc.set(sellOrder);

  return (await doc.get()).data() as SellOrder;
};

// ===============================================================
// expired orders

export const expiredOrders = async (): Promise<ExpiredCacheItem[]> => {
  const result: ExpiredCacheItem[] = [];

  result.push(...(await expiredBuyOrders('validActive')));
  result.push(...(await expiredBuyOrders('validInactive')));
  // result.push(...(await expiredBuyOrders('invalid')));

  result.push(...(await expiredSellOrders('validActive')));
  result.push(...(await expiredSellOrders('validInactive')));
  // result.push(...(await expiredSellOrders('invalid')));

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
