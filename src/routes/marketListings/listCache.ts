import { BuyOrder, MarketListIdType, SellOrder, MarketOrder, isOrderExpired } from '@infinityxyz/lib/types/core';
import { firestore } from 'container';
import { docsToArray } from 'utils/formatters';
import { fstrCnstnts } from '../../constants';

// ---------------------------------------------------------------
// listCache

export interface ExpiredCacheItem {
  listId: MarketListIdType;
  order: MarketOrder;
}

export class ListCache {
  validActiveBuys: Map<string, BuyOrder> = new Map();
  validActiveSells: Map<string, SellOrder> = new Map();

  validInactiveBuys: Map<string, BuyOrder> = new Map();
  validInactiveSells: Map<string, SellOrder> = new Map();

  invalidBuys: Map<string, BuyOrder> = new Map();
  invalidSells: Map<string, SellOrder> = new Map();

  constructor() {
    void this._load();
  }

  buyOrderCache(listId: MarketListIdType): Map<string, BuyOrder> {
    switch (listId) {
      case 'validActive':
        return this.validActiveBuys;
      case 'validInactive':
        return this.validInactiveBuys;
      case 'invalid':
        return this.invalidBuys;
    }
  }

  buyOrders(listId: MarketListIdType): BuyOrder[] {
    return Array.from(this.buyOrderCache(listId).values());
  }

  sellOrderCache(listId: MarketListIdType): Map<string, SellOrder> {
    switch (listId) {
      case 'validActive':
        return this.validActiveSells;
      case 'validInactive':
        return this.validInactiveSells;
      case 'invalid':
        return this.invalidSells;
    }
  }

  sellOrders(listId: MarketListIdType): SellOrder[] {
    return Array.from(this.sellOrderCache(listId).values());
  }

  expiredOrders(): ExpiredCacheItem[] {
    const result: ExpiredCacheItem[] = [];

    result.push(...this._expiredBuyOrders('validActive'));
    result.push(...this._expiredBuyOrders('validInactive'));
    // result.push(...this._expiredBuyOrders('invalid'));

    result.push(...this._expiredSellOrders('validActive'));
    result.push(...this._expiredSellOrders('validInactive'));
    // result.push(...this._expiredSellOrders('invalid'));

    return result;
  }

  _expiredBuyOrders(listId: MarketListIdType): ExpiredCacheItem[] {
    const result: ExpiredCacheItem[] = [];

    for (const order of this.buyOrders(listId)) {
      if (isOrderExpired(order)) {
        result.push({ listId: listId, order: order });
      }
    }

    return result;
  }

  _expiredSellOrders(listId: MarketListIdType): ExpiredCacheItem[] {
    const result: ExpiredCacheItem[] = [];

    for (const order of this.sellOrders(listId)) {
      if (isOrderExpired(order)) {
        result.push({ listId: listId, order: order });
      }
    }

    return result;
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
