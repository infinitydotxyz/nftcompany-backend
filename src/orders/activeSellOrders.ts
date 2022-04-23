import {
  MarketListId,
  OBOrder,
  OBOrderItem
} from '@infinityxyz/lib/types/core';
import { getCurrentOBOrderPrice, isOBOrderExpired } from '@infinityxyz/lib/utils';
import { sellOrdersWithParams } from './marketFirebase';

export class ActiveSellOrders {
  orderMap: Map<string, OBOrder[]> = new Map<string, OBOrder[]>();
  collectionAddresses: string[] = [];

  async addCollectionAddresses(addresses: string[]) {
    const diff = addresses.filter((x) => !this.collectionAddresses.includes(x));

    if (diff.length > 0) {
      this.collectionAddresses.push(...diff);

      // NOTE: addresses is limited to 10, handle that later?
      const orders = await sellOrdersWithParams(MarketListId.ValidActive, diff);

      for (const sellOrder of orders) {
        if (!isOBOrderExpired(sellOrder)) {
          const addrs = sellOrder.nfts.map((e) => e.collectionAddress);
          for (const addr of addrs) {
            let orderArray = this.orderMap.get(addr);
            const activeSellOrder: OBOrder = { ...sellOrder };
            if (!orderArray) {
              orderArray = [activeSellOrder];
            } else {
              orderArray.push(activeSellOrder);
            }
            this.orderMap.set(addr, orderArray);
          }
        }
      }
    }
  }

  async ordersInCollections(nfts: OBOrderItem[]): Promise<OBOrder[]> {
    const result: OBOrder[] = [];
    if (nfts) {
      const addresses = nfts.map((e) => e.collectionAddress);
      await this.addCollectionAddresses(addresses);

      for (const address of addresses) {
        const orders = this.orderMap.get(address);

        if (orders) {
          result.push(...orders);
        }
      }

      const sortedOrders = result.sort((a, b) => {
        const aCurrPrice = getCurrentOBOrderPrice(a);
        const bCurrPrice = getCurrentOBOrderPrice(b);
        if (aCurrPrice.gt(bCurrPrice)) {
          return 1;
        } else if (aCurrPrice.lt(bCurrPrice)) {
          return -1;
        } else {
          return 0;
        }
      });

      return sortedOrders;
    }
    return result;
  }

  async ordersForBuyOrder(buyOrder: OBOrder): Promise<OBOrder[]> {
    const result: OBOrder[] = [];

    const sellOrders = await this.ordersInCollections(buyOrder.nfts);
    const buyCurrPrice = getCurrentOBOrderPrice(buyOrder);
    for (const sellOrder of sellOrders) {
      const sellCurrPrice = getCurrentOBOrderPrice(sellOrder);
      if (sellCurrPrice <= buyCurrPrice) {
        result.push(sellOrder);
      }
    }

    return result;
  }
}
