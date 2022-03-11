import { singleton, container } from 'tsyringe';
import { BuyOrder, orderHash, MarketListIdType, SellOrder } from '@infinityxyz/lib/types/core';
import { firestore } from 'container';
import { docsToArray } from 'utils/formatters';
import { fstrCnstnts } from '../../constants';

@singleton()
export class MarketListingsCache {
  _buyOrders: Map<string, BuyOrder> = new Map();
  _sellOrders: Map<string, SellOrder> = new Map();

  constructor() {
    void this._load();
  }

  async _load() {
    this._sellOrders = await this._loadSellOrders('validActive');
    this._buyOrders = await this._loadBuyOrders('validActive');
  }

  async addBuyOrder(listId: MarketListIdType, buyOrder: BuyOrder): Promise<void> {
    if (!this._buyOrders.has(orderHash(buyOrder))) {
      const order = await this._saveBuyOrder(listId, buyOrder);

      this._buyOrders.set(order.id ?? '', order);
    }
  }

  async addSellOrder(listId: MarketListIdType, sellOrder: SellOrder): Promise<void> {
    if (!this._sellOrders.has(orderHash(sellOrder))) {
      const order = await this._saveSellOrder(listId, sellOrder);

      this._sellOrders.set(order.id ?? '', order);
    }
  }

  async deleteBuyOrder(listId: MarketListIdType, orderId: string): Promise<void> {
    if (this._buyOrders.has(orderId)) {
      this._buyOrders.delete(orderId);

      await this._deleteBuyOrder(listId, orderId);
    }
  }

  async deleteSellOrder(listId: MarketListIdType, orderId: string): Promise<void> {
    if (this._sellOrders.has(orderId)) {
      this._sellOrders.delete(orderId);

      await this._deleteSellOrder(listId, orderId);
    }
  }

  sellOrders(listId: MarketListIdType): SellOrder[] {
    const result: SellOrder[] = [];

    for (const x of this._sellOrders.entries()) {
      result.push(x[1]);
    }

    return result;
  }

  buyOrders(listId: MarketListIdType): BuyOrder[] {
    const result: BuyOrder[] = [];

    for (const x of this._buyOrders.entries()) {
      result.push(x[1]);
    }

    return result;
  }

  async _loadBuyOrders(listId: MarketListIdType): Promise<Map<string, BuyOrder>> {
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
  }

  async _loadSellOrders(listId: MarketListIdType): Promise<Map<string, SellOrder>> {
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
  }

  async _saveSellOrder(listId: MarketListIdType, sellOrder: SellOrder): Promise<SellOrder> {
    const collection = await firestore.db.collection(fstrCnstnts.SELL_ORDERS_COLL).doc(listId).collection('orders');

    // set id to hash
    sellOrder.id = orderHash(sellOrder);

    console.log(JSON.stringify(sellOrder));
    console.log(orderHash(sellOrder));

    const doc = collection.doc(sellOrder.id);
    await doc.set(sellOrder);

    return (await doc.get()).data() as SellOrder;
  }

  async _saveBuyOrder(listId: MarketListIdType, buyOrder: BuyOrder): Promise<BuyOrder> {
    const collection = await firestore.db.collection(fstrCnstnts.BUY_ORDERS_COLL).doc(listId).collection('orders');

    // set id to hash
    buyOrder.id = orderHash(buyOrder);

    console.log(JSON.stringify(buyOrder));
    console.log(orderHash(buyOrder));

    const doc = collection.doc(buyOrder.id);
    await doc.set(buyOrder);

    return (await doc.get()).data() as BuyOrder;
  }

  async _deleteBuyOrder(listId: MarketListIdType, orderId: string): Promise<void> {
    const collection = await firestore.db.collection(fstrCnstnts.BUY_ORDERS_COLL).doc(listId).collection('orders');

    await this._deleteOrder(collection, orderId);
  }

  async _deleteSellOrder(listId: MarketListIdType, orderId: string): Promise<void> {
    const collection = await firestore.db.collection(fstrCnstnts.SELL_ORDERS_COLL).doc(listId).collection('orders');

    await this._deleteOrder(collection, orderId);
  }

  async _deleteOrder(collection: FirebaseFirestore.CollectionReference, orderId: string): Promise<void> {
    if (orderId) {
      const doc = await collection.doc(orderId);

      await doc.delete();
    } else {
      console.log('delete failed, id is blank');
    }
  }
}

// ---------------------------------------------------------------
// singleton

export const marketListingsCache: MarketListingsCache = container.resolve(MarketListingsCache);
