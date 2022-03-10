import { singleton, container } from 'tsyringe';
import { BuyOrder, BuyOrderMatch, MarketOrder, SellOrder } from '@infinityxyz/lib/types/core';
import { marketListingsCache } from 'routes/marketListings/marketListingsCache';

@singleton()
export class MarketOrders {
  async buy(user: string, order: BuyOrder): Promise<BuyOrderMatch | null> {
    await marketListingsCache.addBuyOrder('validActive', order);

    const result = await this.findMatchForBuy(order);

    return result;
  }

  async sell(user: string, order: SellOrder): Promise<BuyOrderMatch[]> {
    await marketListingsCache.addSellOrder('validActive', order);

    const result = await this.findMatchForSell(order);

    return result;
  }

  isOrderExpired(order: MarketOrder) {
    return this.isExpired(order.expiration);
  }

  isExpired(expiration: number): boolean {
    const utcSecondsSinceEpoch = Math.round(Date.now() / 1000);

    // special case of never expire
    if (expiration === 0) {
      return false;
    }

    return expiration <= utcSecondsSinceEpoch;
  }

  async findMatchForSell(sellOrder: SellOrder): Promise<BuyOrderMatch[]> {
    const result: BuyOrderMatch[] = [];

    for (const buyOrder of await marketListingsCache.buyOrders('validActive')) {
      if (!this.isOrderExpired(buyOrder)) {
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
      if (!this.isOrderExpired(sellOrder)) {
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

      if (buyOrder.minNFTs === 1) {
        return { buyOrder: buyOrder, sellOrders: [candiates[0]] };
      } else {
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
    }

    return null;
  }
}

// ---------------------------------------------------------------
// singleton

export const marketOrders: MarketOrders = container.resolve(MarketOrders);
