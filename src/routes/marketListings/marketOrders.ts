import { singleton, container } from 'tsyringe';
import { BuyOrder, BuyOrderMatch, isOrderExpired, MarketListIdType, SellOrder } from '@infinityxyz/lib/types/core';
import { marketListingsCache } from 'routes/marketListings/marketListingsCache';
import { ActiveSellOrders } from './activeSellOrders';

@singleton()
export class MarketOrders {
  async buy(order: BuyOrder, listId: MarketListIdType): Promise<BuyOrderMatch[]> {
    await marketListingsCache.addBuyOrder(listId, order);

    const aso = new ActiveSellOrders();

    const result = await this.findMatchForBuy(order, aso);

    if (result) {
      return [result];
    }

    return [];
  }

  async sell(order: SellOrder, listId: MarketListIdType): Promise<BuyOrderMatch[]> {
    await marketListingsCache.addSellOrder(listId, order);

    const result = await this.marketMatches();

    return result;
  }

  async marketMatches(): Promise<BuyOrderMatch[]> {
    const result: BuyOrderMatch[] = [];
    const aso = new ActiveSellOrders();

    const orders = await marketListingsCache.buyOrders('validActive');
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
