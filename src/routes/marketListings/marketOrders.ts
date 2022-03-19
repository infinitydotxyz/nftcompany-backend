import { singleton, container } from 'tsyringe';
import {
  BuyOrder,
  BuyOrderMatch,
  calculateCurrentPrice,
  isOrderExpired,
  MarketListIdType,
  SellOrder
} from '@infinityxyz/lib/types/core';
import { marketListingsCache } from 'routes/marketListings/marketListingsCache';

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

    for (const buyOrder of marketListingsCache.buyOrders('validActive')) {
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

    for (const sellOrder of marketListingsCache.sellOrders('validActive')) {
      if (!isOrderExpired(sellOrder)) {
        if (buyAddresses.includes(sellOrder.collectionAddress.address)) {
          const currentPrice = calculateCurrentPrice(sellOrder);

          if (currentPrice <= buyOrder.budget) {
            candidates.push(sellOrder);
          }
        }
      }
    }

    if (candidates.length > 0) {
      // sort list
      candidates = candidates.sort((a, b) => {
        const aPrice = calculateCurrentPrice(a);
        const bPrice = calculateCurrentPrice(b);

        return aPrice - bPrice;
      });

      let cash = buyOrder.budget;
      let numNFTs = buyOrder.minNFTs;
      const result: SellOrder[] = [];

      for (const c of candidates) {
        const price = calculateCurrentPrice(c);

        if (numNFTs > 0 && cash >= price) {
          result.push(c);
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
