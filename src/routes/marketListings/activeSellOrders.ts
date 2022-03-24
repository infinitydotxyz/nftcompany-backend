import { Item, OBOrder } from '@infinityxyz/lib/types/core';
import { getCurrentOrderPrice, isOrderExpired } from '@infinityxyz/lib/utils';
import { sellOrdersWithParams } from './marketFirebase';

export class ActiveSellOrders {
  orderMap: Map<string, OBOrder[]> = new Map<string, OBOrder[]>();
  collectionAddresses: string[] = [];

  async addCollectionAddresses(addresses: string[]) {
    const diff = addresses.filter((x) => !this.collectionAddresses.includes(x));

    if (diff.length > 0) {
      this.collectionAddresses.push(...diff);

      // NOTE: addresses is limited to 10, handle that later?
      const orders = await sellOrdersWithParams('validActive', diff);

      for (const sellOrder of orders) {
        if (!isOrderExpired(sellOrder)) {
          const addrs = sellOrder.nfts.map((e) => e.collection);
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

  async ordersInCollections(nfts: Item[]): Promise<OBOrder[]> {
    const result: OBOrder[] = [];

    const addresses = nfts.map((e) => e.collection);
    await this.addCollectionAddresses(addresses);

    for (const address of addresses) {
      const orders = this.orderMap.get(address);

      if (orders) {
        result.push(...orders);
      }
    }

    const sortedOrders = result.sort((a, b) => {
      const aCurrPrice = getCurrentOrderPrice(a);
      const bCurrPrice = getCurrentOrderPrice(a);
      // todo: might need to convert to ETH first to prevent overflow
      return aCurrPrice.sub(bCurrPrice).toNumber();
    });

    return sortedOrders;
  }

  async ordersForBuyOrder(buyOrder: OBOrder): Promise<OBOrder[]> {
    const result: OBOrder[] = [];

    const sellOrders = await this.ordersInCollections(buyOrder.nfts);
    const buyCurrPrice = getCurrentOrderPrice(buyOrder);
    for (const sellOrder of sellOrders) {
      const sellCurrPrice = getCurrentOrderPrice(sellOrder);
      if (sellCurrPrice.lte(buyCurrPrice)) {
        result.push(sellOrder);
      }
    }

    return result;
  }
}
