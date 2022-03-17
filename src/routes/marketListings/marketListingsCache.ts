import { singleton, container } from 'tsyringe';
import { BuyOrder, orderHash, MarketListIdType, SellOrder, MarketOrder, isBuyOrder } from '@infinityxyz/lib/types/core';
import { firestore } from 'container';
import { docsToArray } from 'utils/formatters';
import { fstrCnstnts } from '../../constants';
import { marketOrders } from './marketOrders';

// ---------------------------------------------------------------
// listCache

class ListCache {
  validActiveBuys: Map<string, BuyOrder> = new Map();
  validActiveSells: Map<string, SellOrder> = new Map();

  validInactiveBuys: Map<string, BuyOrder> = new Map();
  validInactiveSells: Map<string, SellOrder> = new Map();

  invalidBuys: Map<string, BuyOrder> = new Map();
  invalidSells: Map<string, SellOrder> = new Map();

  constructor() {
    void this._load();
  }

  async _load() {
    this.validActiveSells = await this._loadSellOrders('validActive');
    this.validInactiveSells = await this._loadSellOrders('validInactive');
    this.invalidSells = await this._loadSellOrders('invalid');

    this.validActiveBuys = await this._loadBuyOrders('validActive');
    this.invalidBuys = await this._loadBuyOrders('invalid');
    this.validInactiveBuys = await this._loadBuyOrders('validInactive');
  }

  // ===============================================================
  // load

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
}

// ---------------------------------------------------------------
// MarketListingsCache

@singleton()
export class MarketListingsCache {
  cache: ListCache = new ListCache();

  async addBuyOrder(listId: MarketListIdType, buyOrder: BuyOrder): Promise<void> {
    const c = this._buyOrderCache(listId);

    if (!c.has(orderHash(buyOrder))) {
      const order = await this._saveBuyOrder(listId, buyOrder);

      c.set(order.id ?? '', order);
    }
  }

  async addSellOrder(listId: MarketListIdType, sellOrder: SellOrder): Promise<void> {
    const c = this._sellOrderCache(listId);

    if (!c.has(orderHash(sellOrder))) {
      const order = await this._saveSellOrder(listId, sellOrder);

      c.set(order.id ?? '', order);
    }
  }

  async deleteBuyOrder(listId: MarketListIdType, orderId: string): Promise<void> {
    const c = this._buyOrderCache(listId);

    if (c.has(orderId)) {
      c.delete(orderId);

      await this._deleteBuyOrder(listId, orderId);
    }
  }

  async deleteSellOrder(listId: MarketListIdType, orderId: string): Promise<void> {
    const c = this._sellOrderCache(listId);

    if (c.has(orderId)) {
      c.delete(orderId);

      await this._deleteSellOrder(listId, orderId);
    }
  }

  async executeBuyOrder(listId: MarketListIdType, orderId: string): Promise<void> {
    const c = this._buyOrderCache(listId);

    if (c.has(orderId)) {
      const buyOrder = c.get(orderId);

      if (buyOrder) {
        const result = await marketOrders.findMatchForBuy(buyOrder);

        // do the block chain stuff here.  If success delete the orders

        if (result) {
          // move order to validInactive
          await this._moveBuyOrder(result.buyOrder, listId, 'validInactive');

          for (const sellOrder of result.sellOrders) {
            await this._moveSellOrder(sellOrder, listId, 'validInactive');
          }
        }
      }
    }
  }

  sellOrders(listId: MarketListIdType): SellOrder[] {
    const result: SellOrder[] = [];
    const c = this._sellOrderCache(listId);

    for (const x of c.entries()) {
      result.push(x[1]);
    }

    return result;
  }

  buyOrders(listId: MarketListIdType): BuyOrder[] {
    const result: BuyOrder[] = [];
    const c = this._buyOrderCache(listId);

    for (const x of c.entries()) {
      result.push(x[1]);
    }

    return result;
  }

  // ===============================================================
  // private

  _buyOrderCache(listId: MarketListIdType): Map<string, BuyOrder> {
    switch (listId) {
      case 'validActive':
        return this.cache.validActiveBuys;
      case 'validInactive':
        return this.cache.validInactiveBuys;
      case 'invalid':
        return this.cache.invalidBuys;
    }
  }

  _sellOrderCache(listId: MarketListIdType): Map<string, SellOrder> {
    switch (listId) {
      case 'validActive':
        return this.cache.validActiveSells;
      case 'validInactive':
        return this.cache.validInactiveSells;
      case 'invalid':
        return this.cache.invalidSells;
    }
  }

  // ===============================================================
  // save

  async _saveSellOrder(listId: MarketListIdType, sellOrder: SellOrder): Promise<SellOrder> {
    const collection = await firestore.db.collection(fstrCnstnts.SELL_ORDERS_COLL).doc(listId).collection('orders');

    // set id to hash
    sellOrder.id = orderHash(sellOrder);

    const doc = collection.doc(sellOrder.id);
    await doc.set(sellOrder);

    return (await doc.get()).data() as SellOrder;
  }

  async _saveBuyOrder(listId: MarketListIdType, buyOrder: BuyOrder): Promise<BuyOrder> {
    const collection = await firestore.db.collection(fstrCnstnts.BUY_ORDERS_COLL).doc(listId).collection('orders');

    // set id to hash
    buyOrder.id = orderHash(buyOrder);

    const doc = collection.doc(buyOrder.id);
    await doc.set(buyOrder);

    return (await doc.get()).data() as BuyOrder;
  }

  // ===============================================================
  // delete

  async _deleteBuyOrder(listId: MarketListIdType, orderId: string): Promise<void> {
    await this._deleteOrder(true, listId, orderId);
  }

  async _deleteSellOrder(listId: MarketListIdType, orderId: string): Promise<void> {
    await this._deleteOrder(false, listId, orderId);
  }

  async _deleteOrder(isBuyOrder: boolean, listId: MarketListIdType, orderId: string): Promise<void> {
    if (orderId) {
      const collection = await firestore.db
        .collection(isBuyOrder ? fstrCnstnts.BUY_ORDERS_COLL : fstrCnstnts.SELL_ORDERS_COLL)
        .doc(listId)
        .collection('orders');

      const doc = await collection.doc(orderId);

      await doc.delete();
    } else {
      console.log('delete failed, id is blank');
    }
  }

  // ===============================================================
  // move

  async _moveBuyOrder(buyOrder: BuyOrder, fromListId: MarketListIdType, toListId: MarketListIdType): Promise<void> {
    await this._moveOrder(buyOrder, fromListId, toListId);
  }

  async _moveSellOrder(sellOrder: SellOrder, fromListId: MarketListIdType, toListId: MarketListIdType): Promise<void> {
    await this._moveOrder(sellOrder, fromListId, toListId);
  }

  async _moveOrder(order: MarketOrder, fromListId: MarketListIdType, toListId: MarketListIdType): Promise<void> {
    if (toListId && fromListId) {
      if (isBuyOrder(order)) {
        await this.addBuyOrder(toListId, order);

        // delete
        await this.deleteBuyOrder(fromListId, order.id ?? '');
      } else {
        await this.addSellOrder(toListId, order as SellOrder);

        // delete
        await this.deleteSellOrder(fromListId, order.id ?? '');
      }
    } else {
      console.log('delete failed, id is blank');
    }
  }
}

// ---------------------------------------------------------------
// singleton

export const marketListingsCache: MarketListingsCache = container.resolve(MarketListingsCache);
