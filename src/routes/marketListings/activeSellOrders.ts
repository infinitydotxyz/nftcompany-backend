import {
  BuyOrder,
  calculateCurrentPrice,
  CollectionAddress,
  isOrderExpired,
  SellOrder
} from '@infinityxyz/lib/types/core';
import { sellOrders } from './marketFirebase';

// appending the current calculated price so we can sort faster
export interface ActiveSellOrder extends SellOrder {
  currentPrice: number;
}

export class ActiveSellOrders {
  orderByAddress: Map<string, ActiveSellOrder[]>;

  async refreshOrders(addresses: string[]) {
    if (!this.orderByAddress) {
      this.orderByAddress = new Map<string, ActiveSellOrder[]>();

      const orders = await sellOrders('validActive');

      for (const sellOrder of orders) {
        if (addresses.includes(sellOrder.collectionAddress.address)) {
          if (!isOrderExpired(sellOrder)) {
            let orderArray = this.orderByAddress.get(sellOrder.collectionAddress.address);

            const activeSellOrder: ActiveSellOrder = { ...sellOrder, currentPrice: calculateCurrentPrice(sellOrder) };

            if (!orderArray) {
              orderArray = [activeSellOrder];
            } else {
              orderArray.push(activeSellOrder);
            }

            this.orderByAddress.set(sellOrder.collectionAddress.address, orderArray);
          }
        }
      }
    }
  }

  async ordersInCollections(collectionAddresses: CollectionAddress[]): Promise<ActiveSellOrder[]> {
    const result: ActiveSellOrder[] = [];

    const addresses = collectionAddresses.map((e) => e.address);
    await this.refreshOrders(addresses);

    for (const address of collectionAddresses) {
      const orders = this.orderByAddress.get(address.address);

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
