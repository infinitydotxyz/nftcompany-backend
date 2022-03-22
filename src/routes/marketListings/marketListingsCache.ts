import { singleton, container } from 'tsyringe';
import { BuyOrder, orderHash, MarketListIdType, SellOrder, MarketOrder, isBuyOrder } from '@infinityxyz/lib/types/core';
import { firestore } from 'container';
import { fstrCnstnts } from '../../constants';
import { marketOrders } from './marketOrders';
import { MarketOrderTask } from './marketOrderTask';
import { ExpiredCacheItem, ListCache } from './listCache';
import { ActiveSellOrders } from './activeSellOrders';

@singleton()
export class MarketListingsCache {
  cache: ListCache = new ListCache();

  // runs in the background, scanning the order list
  task: MarketOrderTask = new MarketOrderTask();

  async addBuyOrder(listId: MarketListIdType, buyOrder: BuyOrder): Promise<void> {
    const c = await this.cache.buyOrderCache(listId);

    if (!c.has(orderHash(buyOrder))) {
      await this._saveBuyOrder(listId, buyOrder);
    } else {
      console.log(`addBuyOrder already exists ${orderHash(buyOrder)} ${listId}`);
    }
  }

  async addSellOrder(listId: MarketListIdType, sellOrder: SellOrder): Promise<void> {
    const c = await this.cache.sellOrderCache(listId);

    if (!c.has(orderHash(sellOrder))) {
      await this._saveSellOrder(listId, sellOrder);
    } else {
      console.log(`deleteBuyOrder order not found ${orderHash(sellOrder)} ${listId}`);
    }
  }

  async deleteBuyOrder(listId: MarketListIdType, orderId: string): Promise<void> {
    const c = await this.cache.buyOrderCache(listId);

    if (c.has(orderId)) {
      await this._deleteOrder(true, listId, orderId);
    } else {
      console.log(`deleteBuyOrder order not found ${orderId} ${listId}`);
    }
  }

  async deleteSellOrder(listId: MarketListIdType, orderId: string): Promise<void> {
    const c = await this.cache.sellOrderCache(listId);

    if (c.has(orderId)) {
      await this._deleteOrder(false, listId, orderId);
    } else {
      console.log(`deleteSellOrder order not found ${orderId} ${listId}`);
    }
  }

  async executeBuyOrder(orderId: string): Promise<void> {
    const c = await this.cache.buyOrderCache('validActive');

    if (c.has(orderId)) {
      const buyOrder = c.get(orderId);

      if (buyOrder) {
        const aso = new ActiveSellOrders();
        const result = await marketOrders.findMatchForBuy(buyOrder, aso);

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

  async sellOrders(listId: MarketListIdType): Promise<SellOrder[]> {
    return await this.cache.sellOrders(listId);
  }

  async buyOrders(listId: MarketListIdType): Promise<BuyOrder[]> {
    return await this.cache.buyOrders(listId);
  }

  async expiredOrders(): Promise<ExpiredCacheItem[]> {
    return await this.cache.expiredOrders();
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

  async _deleteOrder(isBuyOrder: boolean, listId: MarketListIdType, orderId: string): Promise<void> {
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
      console.log('delete failed, toListId || fromListId is blank');
    }
  }
}

// ---------------------------------------------------------------
// singleton

export const marketListingsCache: MarketListingsCache = container.resolve(MarketListingsCache);
