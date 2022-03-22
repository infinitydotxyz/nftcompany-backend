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
  async buyOrderCache(listId: MarketListIdType): Promise<Map<string, BuyOrder>> {
    return await this._loadBuyOrders(listId);
  }

  async buyOrders(listId: MarketListIdType): Promise<BuyOrder[]> {
    const orders = await this.buyOrderCache(listId);

    return Array.from(orders.values());
  }

  async sellOrderCache(listId: MarketListIdType): Promise<Map<string, SellOrder>> {
    return await this._loadSellOrders(listId);
  }

  async sellOrders(listId: MarketListIdType): Promise<SellOrder[]> {
    const orders = await this.sellOrderCache(listId);

    return Array.from(orders.values());
  }

  async expiredOrders(): Promise<ExpiredCacheItem[]> {
    const result: ExpiredCacheItem[] = [];

    result.push(...(await this._expiredBuyOrders('validActive')));
    result.push(...(await this._expiredBuyOrders('validInactive')));
    // result.push(...(await this._expiredBuyOrders('invalid')));

    result.push(...(await this._expiredSellOrders('validActive')));
    result.push(...(await this._expiredSellOrders('validInactive')));
    // result.push(...(await this._expiredSellOrders('invalid')));

    return result;
  }

  async _expiredBuyOrders(listId: MarketListIdType): Promise<ExpiredCacheItem[]> {
    const result: ExpiredCacheItem[] = [];

    const orders = await this.buyOrders(listId);
    for (const order of orders) {
      if (isOrderExpired(order)) {
        result.push({ listId: listId, order: order });
      }
    }

    return result;
  }

  async _expiredSellOrders(listId: MarketListIdType): Promise<ExpiredCacheItem[]> {
    const result: ExpiredCacheItem[] = [];

    const orders = await this.sellOrders(listId);
    for (const order of orders) {
      if (isOrderExpired(order)) {
        result.push({ listId: listId, order: order });
      }
    }

    return result;
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
