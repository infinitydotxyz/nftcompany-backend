import { singleton, container } from 'tsyringe';
import { BuyOrder, BuyOrderMatch, MarketOrder, SellOrder } from '@infinityxyz/lib/types/core';

@singleton()
export class MarketOrders {
  buyOrders: BuyOrder[] = [];
  sellOrders: SellOrder[] = [];

  async buy(user: string, order: BuyOrder): Promise<BuyOrderMatch | null> {
    this.buyOrders.push(order);

    const result = this.findMatchForBuy(order);

    return result;
  }

  async sell(user: string, order: SellOrder): Promise<BuyOrderMatch[]> {
    this.sellOrders.push(order);

    const result = this.findMatchForSell(order);

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

  findMatchForSell(sellOrder: SellOrder): BuyOrderMatch[] {
    const result: BuyOrderMatch[] = [];

    for (const buyOrder of this.buyOrders) {
      if (!this.isOrderExpired(buyOrder)) {
        const order = this.findMatchForBuy(buyOrder);

        if (order) {
          result.push(order);
        }
      }
    }

    return result;
  }

  findMatchForBuy(buyOrder: BuyOrder): BuyOrderMatch | null {
    let candiates: SellOrder[] = [];

    for (const sellOrder of this.sellOrders) {
      if (!this.isOrderExpired(sellOrder)) {
        if (buyOrder.collections.includes(sellOrder.collection)) {
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
