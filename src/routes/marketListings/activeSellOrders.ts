import {
  BuyOrder,
  calculateCurrentPrice,
  CollectionAddress,
  isOrderExpired,
  SellOrder
} from '@infinityxyz/lib/types/core';
import { sellOrdersWithParams } from './marketFirebase';

// appending the current calculated price so we can sort faster
export interface ActiveSellOrder extends SellOrder {
  currentPrice: number;
}

export class ActiveSellOrders {
  orderMap: Map<string, ActiveSellOrder[]> = new Map<string, ActiveSellOrder[]>();
  collectionAddresses: string[] = [];

  async addCollectionAddresses(addresses: string[]) {
    const diff = addresses.filter((x) => !this.collectionAddresses.includes(x));

    if (diff.length > 0) {
      this.collectionAddresses.push(...diff);

      // NOTE: addresses is limited to 10, handle that later?
      const orders = await sellOrdersWithParams('validActive', diff);

      for (const sellOrder of orders) {
        if (!isOrderExpired(sellOrder)) {
          let orderArray = this.orderMap.get(sellOrder.collectionAddress.address);

          const activeSellOrder: ActiveSellOrder = { ...sellOrder, currentPrice: calculateCurrentPrice(sellOrder) };

          if (!orderArray) {
            orderArray = [activeSellOrder];
          } else {
            orderArray.push(activeSellOrder);
          }

          this.orderMap.set(sellOrder.collectionAddress.address, orderArray);
        }
      }
    }
  }

  async ordersInCollections(collectionAddresses: CollectionAddress[]): Promise<ActiveSellOrder[]> {
    const result: ActiveSellOrder[] = [];

    const addresses = collectionAddresses.map((e) => e.address);
    await this.addCollectionAddresses(addresses);

    for (const address of collectionAddresses) {
      const orders = this.orderMap.get(address.address);

      if (orders) {
        result.push(...orders);
      }
    }

    const sortedOrders = result.sort((a, b) => {
      return a.currentPrice - b.currentPrice;
    });

    return sortedOrders;
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
