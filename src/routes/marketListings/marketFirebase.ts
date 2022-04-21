import { isOBOrderExpired, MarketListId, OBOrder } from '@infinityxyz/lib/types/core';
import { firestore } from 'container';
import { docsToArray } from 'utils/formatters';
import { fstrCnstnts } from '../../constants';
import { createHash } from 'crypto';

export interface ExpiredCacheItem {
  listId: MarketListId;
  order: OBOrder;
}

interface SellOrderSave extends OBOrder {
  collectionAddresses: string[];
}

export const deleteOrder = async (isBuyOrder: boolean, listId: MarketListId, orderId: string): Promise<void> => {
  if (orderId) {
    const collection = firestore.db
      .collection(isBuyOrder ? fstrCnstnts.BUY_ORDERS_COLL : fstrCnstnts.SELL_ORDERS_COLL)
      .doc(listId)
      .collection('orders');

    const doc = collection.doc(orderId);

    await doc.delete();
  } else {
    console.log('_deleteOrder, id is blank');
  }
};

export const moveOrder = async (order: OBOrder, fromListId: MarketListId, toListId: MarketListId): Promise<void> => {
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

export const buyOrders = async (listId: MarketListId, cursor?: string, limit?: number): Promise<OBOrder[]> => {
  const orders = await orderMap(true, listId, cursor, limit);

  return Array.from(orders.values());
};

export const addBuyOrder = async (listId: MarketListId, buyOrder: OBOrder): Promise<void> => {
  const c = await orderMap(true, listId);

  if (!c.has(obOrderHash(buyOrder))) {
    await saveBuyOrder(listId, buyOrder);
  } else {
    console.log(`addBuyOrder already exists ${obOrderHash(buyOrder)} ${listId}`);
  }
};

export const deleteBuyOrder = async (listId: MarketListId, orderId: string): Promise<void> => {
  const c = await orderMap(true, listId);

  if (c.has(orderId)) {
    await deleteOrder(true, listId, orderId);
  } else {
    console.log(`deleteBuyOrder order not found ${orderId} ${listId}`);
  }
};

export const saveBuyOrder = async (listId: MarketListId, buyOrder: OBOrder): Promise<OBOrder> => {
  const collection = firestore.db.collection(fstrCnstnts.BUY_ORDERS_COLL).doc(listId).collection('orders');

  // Set id to hash
  buyOrder.id = obOrderHash(buyOrder);

  const doc = collection.doc(buyOrder.id);
  await doc.set(buyOrder);

  return (await doc.get()).data() as OBOrder;
};

// ===============================================================
// Sell orders

export const sellOrders = async (listId: MarketListId, cursor?: string, limit?: number): Promise<OBOrder[]> => {
  const orders = await orderMap(false, listId, cursor, limit);

  return Array.from(orders.values());
};

const getCollection = (buyOrder: boolean, listId: MarketListId): FirebaseFirestore.CollectionReference => {
  return firestore.db
    .collection(buyOrder ? fstrCnstnts.BUY_ORDERS_COLL : fstrCnstnts.SELL_ORDERS_COLL)
    .doc(listId)
    .collection('orders');
};

export const getOrder = async (buyOrder: boolean, listId: MarketListId, id: string) => {
  const collection = getCollection(buyOrder, listId);

  return await collection.doc(id).get();
};

export const orderMap = async (
  buyOrder: boolean,
  listId: MarketListId,
  cursor?: string,
  limit?: number
): Promise<Map<string, OBOrder>> => {
  const collection = getCollection(buyOrder, listId);

  let result: FirebaseFirestore.QuerySnapshot;
  let query: FirebaseFirestore.Query;
  if (limit && limit > 0) {
    query = collection.limit(limit);

    if (cursor) {
      // cursor is the order.id (last item of previous result)
      const doc = await getOrder(buyOrder, listId, cursor);
      query = query.startAfter(doc);
    }

    result = await query.get();
  } else {
    result = await collection.get();
  }

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

export const sellOrdersWithParams = async (listId: MarketListId, collectionAddresses: string[]): Promise<OBOrder[]> => {
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

export const addSellOrder = async (listId: MarketListId, sellOrder: OBOrder): Promise<void> => {
  const c = await orderMap(false, listId);

  if (!c.has(obOrderHash(sellOrder))) {
    await saveSellOrder(listId, sellOrder);
  } else {
    console.log(`deleteBuyOrder order not found ${obOrderHash(sellOrder)} ${listId}`);
  }
};

export const deleteSellOrder = async (listId: MarketListId, orderId: string): Promise<void> => {
  const c = await orderMap(false, listId);

  if (c.has(orderId)) {
    await deleteOrder(false, listId, orderId);
  } else {
    console.log(`deleteSellOrder order not found ${orderId} ${listId}`);
  }
};

export const saveSellOrder = async (listId: MarketListId, sellOrder: OBOrder): Promise<OBOrder> => {
  const collection = firestore.db.collection(fstrCnstnts.SELL_ORDERS_COLL).doc(listId).collection('orders');

  // Set id to hash
  sellOrder.id = obOrderHash(sellOrder);

  // Add collectionAddresses which is used for queries
  const collectionAddresses: string[] = [];
  for (const nft of sellOrder.nfts) {
    collectionAddresses.push(nft.collectionAddress);
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

  result.push(...(await expiredBuyOrders(MarketListId.ValidActive)));
  result.push(...(await expiredBuyOrders(MarketListId.ValidInactive)));
  // Result.push(...(await expiredBuyOrders('invalid')));

  result.push(...(await expiredSellOrders(MarketListId.ValidActive)));
  result.push(...(await expiredSellOrders(MarketListId.ValidInactive)));
  // Result.push(...(await expiredSellOrders('invalid')));

  return result;
};

export const expiredBuyOrders = async (listId: MarketListId): Promise<ExpiredCacheItem[]> => {
  const result: ExpiredCacheItem[] = [];

  const orders = await buyOrders(listId);
  for (const order of orders) {
    if (isOBOrderExpired(order)) {
      result.push({ listId: listId, order: order });
    }
  }

  return result;
};

export const expiredSellOrders = async (listId: MarketListId): Promise<ExpiredCacheItem[]> => {
  const result: ExpiredCacheItem[] = [];

  const orders = await sellOrders(listId);
  for (const order of orders) {
    if (isOBOrderExpired(order)) {
      result.push({ listId: listId, order: order });
    }
  }

  return result;
};

// ============= utils =============

// todo: this needs to change
export const obOrderHash = (obj: OBOrder): string => {
  const copy = JSON.parse(JSON.stringify(obj));

  // we don't want the id part of the hash
  copy.id = undefined;

  // we don't want the currentPrice part of the hash
  // this is set on ActiveSellOrder
  copy.currentPrice = undefined;

  // added to to sell orders to help queries
  copy.collectionAddresses = undefined;

  let data = '';

  // JSON.stringify can have different results depending on order of keys
  // sort keys first
  const keys = Object.keys(copy).sort();
  for (const key of keys) {
    if (key === 'extraParams' || key === 'execParams') {
      continue;
    } else if (key === 'nfts') {
      const collectionAddresses = [];
      const ids = [];

      for (const item of obj.nfts) {
        collectionAddresses.push(item.collectionAddress);
        ids.push(...item.tokens);
      }

      collectionAddresses.sort();
      ids.sort((a, b) => {
        return a.tokenId.localeCompare(b.tokenId);
      });

      data += `cols: ${collectionAddresses.toString()}`;
      data += `ids: ${ids.toString()}`;
    } else {
      const val = copy[key];
      if (val) {
        data += `${key}: ${val.toString()}`;
      }
    }
  }
  return createHash('sha256').update(data).digest('hex').trim().toLowerCase();
};

export const areOBOrdersEqual = (a: OBOrder, b: OBOrder): boolean => {
  // use ids if set, id is hash
  if (a.id && b.id) {
    return a.id === b.id;
  }

  return obOrderHash(a) === obOrderHash(b);
};
