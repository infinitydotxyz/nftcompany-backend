import { singleton, container } from 'tsyringe';
import { BuyOrder, BuyOrderMatch, isOrderExpired, MarketListIdType, SellOrder } from '@infinityxyz/lib/types/core';
import { ActiveSellOrders } from './activeSellOrders';
import { MarketOrderTask } from './marketOrderTask';
import { addBuyOrder, addSellOrder, buyOrderMap, buyOrders, moveOrder } from './marketFirebase';

@singleton()
export class MarketOrders {
  // runs in the background, scanning the order list
  task: MarketOrderTask = new MarketOrderTask();

  async executeBuyOrder(orderId: string): Promise<void> {
    const c = await buyOrderMap('validActive');

    if (c.has(orderId)) {
      const buyOrder = c.get(orderId);

      if (buyOrder) {
        const aso = new ActiveSellOrders();
        const result = await marketOrders.findMatchForBuy(buyOrder, aso);

        // do the block chain stuff here.  If success delete the orders

        if (result) {
          // move order to validInactive
          await moveOrder(result.buyOrder, 'validActive', 'validInactive');

          for (const sellOrder of result.sellOrders) {
            await moveOrder(sellOrder, 'validActive', 'validInactive');
          }
        }
      }
    }
  }

  async buy(order: BuyOrder, listId: MarketListIdType): Promise<BuyOrderMatch[]> {
    await addBuyOrder(listId, order);

    const aso = new ActiveSellOrders();
    const result = await this.findMatchForBuy(order, aso);

    if (result) {
      return [result];
    }

    return [];
  }

  async sell(order: SellOrder, listId: MarketListIdType): Promise<BuyOrderMatch[]> {
    await addSellOrder(listId, order);

    const result = await this.marketMatches();

    return result;
  }

  async marketMatches(): Promise<BuyOrderMatch[]> {
    const result: BuyOrderMatch[] = [];
    const aso = new ActiveSellOrders();

    const orders = await buyOrders('validActive');
    for (const buyOrder of orders) {
      if (!isOrderExpired(buyOrder)) {
        const order = await this.findMatchForBuy(buyOrder, aso);

        if (order) {
          result.push(order);
        }
      }
    }

    return result;
  }

  async findMatchForBuy(buyOrder: BuyOrder, aso: ActiveSellOrders): Promise<BuyOrderMatch | null> {
    const sellOrders = await aso.ordersForBuyOrder(buyOrder);

    if (sellOrders.length > 0) {
      let cash = buyOrder.budget;
      let numNFTs = buyOrder.minNFTs;
      const result: SellOrder[] = [];

      for (const sellOrder of sellOrders) {
        const price = sellOrder.currentPrice;

        if (numNFTs > 0 && cash >= price) {
          result.push(sellOrder);
          cash -= price;
          numNFTs -= 1;
        } else {
          break;
        }
      }

      if (result.length === buyOrder.minNFTs) {
        return { buyOrder: buyOrder, sellOrders: result };
      }
    }

    return null;
  }
}

// ---------------------------------------------------------------
// singleton

export const marketOrders: MarketOrders = container.resolve(MarketOrders);
