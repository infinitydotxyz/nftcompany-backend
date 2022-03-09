import { singleton, container } from 'tsyringe';
import { BuyOrder, MarketOrder, SellOrder } from '@infinityxyz/lib/types/core';

@singleton()
export class MarketOrders {
  buyOrders: BuyOrder[] = [];
  sellOrders: SellOrder[] = [];

  async buy(user: string, order: BuyOrder): Promise<string> {
    this.buyOrders.push(order);

    const found = this.findMatchForBuy(order);

    if (found) {
      console.log(found);
    }

    return 'ok';
  }

  async sell(user: string, order: SellOrder): Promise<string> {
    this.sellOrders.push(order);

    const found = this.findMatchForSell(order);

    if (found) {
      console.log(found);
    }

    return 'ok';
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

  findMatchForSell(order: SellOrder): BuyOrder | null {
    for (const x of this.sellOrders) {
      console.log(x);
    }

    return null;
  }

  findMatchForBuy(order: BuyOrder): SellOrder | null {
    for (const x of this.sellOrders) {
      console.log(x);
    }

    return null;
  }
}

// ---------------------------------------------------------------
// singleton

export const marketOrders: MarketOrders = container.resolve(MarketOrders);
