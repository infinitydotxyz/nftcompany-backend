import { singleton, container } from 'tsyringe';
import { BuyOrder, BuyOrderMatch, isOrderExpired, SellOrder } from '@infinityxyz/lib/types/core';
import { marketListingsCache } from 'routes/marketListings/marketListingsCache';

@singleton()
export class MarketOrders {
  async buy(order: BuyOrder): Promise<BuyOrderMatch[]> {
    await marketListingsCache.addBuyOrder('validActive', order);

    const result = await this.findMatchForBuy(order);

    if (result) {
      return [result];
    }

    return [];
  }

  async sell(order: SellOrder): Promise<BuyOrderMatch[]> {
    await marketListingsCache.addSellOrder('validActive', order);

    const result = await this.marketMatches();

    return result;
  }

  async marketMatches(): Promise<BuyOrderMatch[]> {
    const result: BuyOrderMatch[] = [];

    for (const buyOrder of await marketListingsCache.buyOrders('validActive')) {
      if (!isOrderExpired(buyOrder)) {
        const order = await this.findMatchForBuy(buyOrder);

        if (order) {
          result.push(order);
        }
      }
    }

    return result;
  }

  async findMatchForBuy(buyOrder: BuyOrder): Promise<BuyOrderMatch | null> {
    let candiates: SellOrder[] = [];

    for (const sellOrder of await marketListingsCache.sellOrders('validActive')) {
      if (!isOrderExpired(sellOrder)) {
        if (buyOrder.collectionAddresses.includes(sellOrder.collectionAddress)) {
          if (sellOrder.price <= buyOrder.budget) {
            candiates.push(sellOrder);
          }
        }
      }
    }

    if (candiates.length > 0) {
      // sort list
      candiates = candiates.sort((a, b) => {
        return a.price - b.price;
      });

      let cash = buyOrder.budget;
      let numNFTs = buyOrder.minNFTs;
      const result: SellOrder[] = [];

      for (const c of candiates) {
        if (numNFTs > 0 && cash >= c.price) {
          result.push(c);
          cash -= c.price;
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
