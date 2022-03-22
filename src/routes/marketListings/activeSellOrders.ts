import {
  BuyOrder,
  calculateCurrentPrice,
  CollectionAddress,
  isOrderExpired,
  SellOrder
} from '@infinityxyz/lib/types/core';
import { marketListingsCache } from 'routes/marketListings/marketListingsCache';

// appending the current calculated price so we can sort faster
export interface ActiveSellOrder extends SellOrder {
  currentPrice: number;
}

export class ActiveSellOrders {
  orderByAddress: Map<string, ActiveSellOrder[]> = new Map<string, ActiveSellOrder[]>();
  isDirty: boolean = true;

  async refreshOrders() {
    if (this.isDirty) {
      this.isDirty = false;

      const newOrdersByAddress: Map<string, ActiveSellOrder[]> = new Map<string, ActiveSellOrder[]>();
      const orders = await marketListingsCache.sellOrders('validActive');

      for (const sellOrder of orders) {
        // remove any expired
        if (!isOrderExpired(sellOrder)) {
          let orderArray = newOrdersByAddress.get(sellOrder.collectionAddress.address);

          // SNG - better way to cast this?
          const activeSellOrder: ActiveSellOrder = sellOrder as ActiveSellOrder;
          activeSellOrder.currentPrice = calculateCurrentPrice(sellOrder);

          if (!orderArray) {
            orderArray = [activeSellOrder];
          } else {
            orderArray.push(activeSellOrder);
          }

          newOrdersByAddress.set(sellOrder.collectionAddress.address, orderArray);
        }
      }

      // clear existing map
      this.orderByAddress = new Map<string, ActiveSellOrder[]>();

      // sort lists
      for (const [key, sellOrders] of newOrdersByAddress) {
        const sortedOrders = sellOrders.sort((a, b) => {
          return a.currentPrice - b.currentPrice;
        });

        this.orderByAddress.set(key, sortedOrders);
      }
    }
  }

  async ordersInCollections(collectionAddresses: CollectionAddress[]): Promise<ActiveSellOrder[]> {
    const sellOrders: ActiveSellOrder[] = [];

    await this.refreshOrders();

    for (const address of collectionAddresses) {
      const orders = this.orderByAddress.get(address.address);

      if (orders) {
        sellOrders.push(...orders);
      }
    }

    return sellOrders;
  }

  async ordersForBuyOrder(buyOrder: BuyOrder): Promise<ActiveSellOrder[]> {
    const result: ActiveSellOrder[] = [];

    const sellOrders = await this.ordersInCollections(buyOrder.collectionAddresses);

    for (const sellOrder of sellOrders) {
      if (sellOrder.currentPrice <= buyOrder.budget) {
        result.push(sellOrder);
      }
    }

    return result;
  }
}
