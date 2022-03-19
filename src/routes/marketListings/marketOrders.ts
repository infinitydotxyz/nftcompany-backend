import { singleton, container } from 'tsyringe';
import { BuyOrder, BuyOrderMatch, isOrderExpired, MarketListIdType } from '@infinityxyz/lib/types/core';
import { marketListingsCache } from 'routes/marketListings/marketListingsCache';

/**
 * types mismatch from lib
 */
type SellOrder = any;
@singleton()
export class MarketOrders {
  async buy(order: BuyOrder, listId: MarketListIdType): Promise<BuyOrderMatch[]> {
    await marketListingsCache.addBuyOrder(listId, order);

    const result = await this.findMatchForBuy(order);

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
    let candidates: SellOrder[] = [];

    const buyAddresses = buyOrder.collectionAddresses.map((e) => e.address);

    for (const sellOrder of await marketListingsCache.sellOrders('validActive')) {
      if (!isOrderExpired(sellOrder)) {
        if (buyAddresses.includes(sellOrder.collectionAddress.address)) {
          if ((sellOrder as any).price <= buyOrder.budget) {
            // types from lib are broken
            candidates.push(sellOrder);
          }
        }
      }
    }

    if (candidates.length > 0) {
      // sort list
      candidates = candidates.sort((a, b) => {
        return a.price - b.price;
      });

      let cash = buyOrder.budget;
      let numNFTs = buyOrder.minNFTs;
      const result: SellOrder[] = [];

      for (const c of candidates) {
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
