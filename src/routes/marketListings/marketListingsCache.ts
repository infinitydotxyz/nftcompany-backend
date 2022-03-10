import { singleton, container } from 'tsyringe';
import { BuyOrder, SellOrder } from '@infinityxyz/lib/types/core';
import { firestore } from 'container';
import { docsToArray } from 'utils/formatters';
import { fstrCnstnts } from '../../constants';

@singleton()
export class MarketListingsCache {
  _buyOrders: BuyOrder[] = [];
  _sellOrders: SellOrder[] = [];

  addBuyOrder(buyOrder: BuyOrder) {
    this._buyOrders.push(buyOrder);
  }

  addSellOrder(sellOrder: SellOrder) {
    this._sellOrders.push(sellOrder);
  }

  async sellOrders(): Promise<SellOrder[]> {
    const result = await firestore.db
      .collection(fstrCnstnts.SELL_ORDERS_COLL)
      .doc('validActive')
      .collection('validActive')
      .get();

    if (result.docs) {
      const { results, count } = docsToArray(result.docs);

      console.log(count);

      return results;
    }

    return [];
  }
}

// ---------------------------------------------------------------
// singleton

export const marketListingsCache: MarketListingsCache = container.resolve(MarketListingsCache);
