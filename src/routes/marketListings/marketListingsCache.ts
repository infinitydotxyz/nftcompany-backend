import { singleton, container } from 'tsyringe';
import { BuyOrder, SellOrder } from '@infinityxyz/lib/types/core';
import { firestore } from 'container';
import { docsToArray } from 'utils/formatters';
import { fstrCnstnts } from '../../constants';
import { ListIdType } from './index';

@singleton()
export class MarketListingsCache {
  _buyOrders: BuyOrder[] = [];
  _sellOrders: SellOrder[] = [];

  constructor() {
    void this._load();
  }

  async _load() {
    this._sellOrders = await this.loadSellOrders('validActive');
    this._buyOrders = await this.loadBuyOrders('validActive');
  }

  async addBuyOrder(listId: ListIdType, buyOrder: BuyOrder): Promise<void> {
    this._buyOrders.push(buyOrder);

    await this.saveBuyOrder(listId, buyOrder);
  }

  async addSellOrder(listId: ListIdType, sellOrder: SellOrder): Promise<void> {
    this._sellOrders.push(sellOrder);

    await this.saveSellOrder(listId, sellOrder);
  }

  sellOrders(listId: ListIdType): SellOrder[] {
    return this._sellOrders;
  }

  buyOrders(listId: ListIdType): BuyOrder[] {
    return this._buyOrders;
  }

  async loadBuyOrders(listId: ListIdType): Promise<BuyOrder[]> {
    const result = await firestore.db.collection(fstrCnstnts.BUY_ORDERS_COLL).doc(listId).collection('orders').get();
    if (result.docs) {
      const { results } = docsToArray(result.docs);

      return results;
    }

    return [];
  }

  async loadSellOrders(listId: ListIdType): Promise<SellOrder[]> {
    const result = await firestore.db.collection(fstrCnstnts.SELL_ORDERS_COLL).doc(listId).collection('orders').get();
    if (result.docs) {
      const { results } = docsToArray(result.docs);

      return results;
    }

    return [];
  }

  async saveSellOrder(listId: ListIdType, sellOrder: SellOrder): Promise<void> {
    const collection = await firestore.db.collection(fstrCnstnts.SELL_ORDERS_COLL).doc(listId).collection('orders');

    await collection.add(sellOrder);
  }

  async saveBuyOrder(listId: ListIdType, buyOrder: BuyOrder): Promise<void> {
    const collection = await firestore.db.collection(fstrCnstnts.BUY_ORDERS_COLL).doc(listId).collection('orders');

    await collection.add(buyOrder);
  }
}

// ---------------------------------------------------------------
// singleton

export const marketListingsCache: MarketListingsCache = container.resolve(MarketListingsCache);
