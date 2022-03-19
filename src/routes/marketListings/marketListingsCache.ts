import { singleton, container } from 'tsyringe';
import { BuyOrder, orderHash, MarketListIdType, SellOrder, MarketOrder, isBuyOrder } from '@infinityxyz/lib/types/core';
import { firestore } from 'container';
import { fstrCnstnts } from '../../constants';
import { marketOrders } from './marketOrders';
import { MarketOrderTask } from './marketOrderTask';
import { ExpiredCacheItem, ListCache } from './listCache';

@singleton()
export class MarketListingsCache {
  cache: ListCache = new ListCache();

  // runs in the background, scanning the order list
  task: MarketOrderTask = new MarketOrderTask();

  async addBuyOrder(listId: MarketListIdType, buyOrder: BuyOrder): Promise<void> {
    const c = this.cache.buyOrderCache(listId);

    if (!c.has(orderHash(buyOrder))) {
      const order = await this._saveBuyOrder(listId, buyOrder);

      c.set(order.id ?? '', order);
    }
  }

  async addSellOrder(listId: MarketListIdType, sellOrder: SellOrder): Promise<void> {
    const c = this.cache.sellOrderCache(listId);

    if (!c.has(orderHash(sellOrder))) {
      const order = await this._saveSellOrder(listId, sellOrder);

      c.set(order.id ?? '', order);
    }
  }

  async deleteBuyOrder(listId: MarketListIdType, orderId: string): Promise<void> {
    const c = this.cache.buyOrderCache(listId);

    if (c.has(orderId)) {
      c.delete(orderId);

      await this._deleteBuyOrder(listId, orderId);
    }
  }

  async deleteSellOrder(listId: MarketListIdType, orderId: string): Promise<void> {
    const c = this.cache.sellOrderCache(listId);

    if (c.has(orderId)) {
      c.delete(orderId);

      await this._deleteSellOrder(listId, orderId);
    }
  }

  async executeBuyOrder(orderId: string): Promise<void> {
    const c = this.cache.buyOrderCache('validActive');

    if (c.has(orderId)) {
      const buyOrder = c.get(orderId);

      if (buyOrder) {
        const result = await marketOrders.findMatchForBuy(buyOrder);

        // do the block chain stuff here.  If success delete the orders

        if (result) {
          // move order to validInactive
          await this._moveOrder(result.buyOrder, 'validActive', 'validInactive');

          for (const sellOrder of result.sellOrders) {
            await this._moveOrder(sellOrder, 'validActive', 'validInactive');
          }
        }
      }
    }
  }

  sellOrders(listId: MarketListIdType): SellOrder[] {
    return this.cache.sellOrders(listId);
  }

  buyOrders(listId: MarketListIdType): BuyOrder[] {
    return this.cache.buyOrders(listId);
  }

  expiredOrders(): ExpiredCacheItem[] {
    return this.cache.expiredOrders();
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
