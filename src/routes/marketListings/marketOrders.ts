import { singleton, container } from 'tsyringe';
import {
  getCurrentOBOrderPrice,
  isOBOrderExpired,
  OBOrder,
  BuyOrderMatch,
  MarketListId
} from '@infinityxyz/lib/types/core';
import { ActiveSellOrders } from './activeSellOrders';
import { addBuyOrder, addSellOrder, orderMap, buyOrders, moveOrder } from './marketFirebase';
import { BigNumber } from 'ethers';

@singleton()
export class MarketOrders {
  // Runs in the background, scanning the order list
  // commented becasuse it is crashing the server
  // task: MarketOrderTask = new MarketOrderTask();

  async executeBuyOrder(orderId: string): Promise<void> {
    const c = await orderMap(true, MarketListId.ValidActive);

    if (c.has(orderId)) {
      const buyOrder = c.get(orderId);

      if (buyOrder) {
        const aso = new ActiveSellOrders();
        const result = await marketOrders.findMatchForBuy(buyOrder, aso);

        // Do the block chain stuff here.  If success delete the orders

        if (result) {
          // Move order to validInactive
          await moveOrder(result.buyOrder, MarketListId.ValidActive, MarketListId.ValidInactive);

          for (const sellOrder of result.sellOrders) {
            await moveOrder(sellOrder, MarketListId.ValidActive, MarketListId.ValidInactive);
          }
        }
      }
    }
  }

  async buy(order: OBOrder, listId: MarketListId): Promise<BuyOrderMatch[]> {
    await addBuyOrder(listId, order);

    const aso = new ActiveSellOrders();
    const result = await this.findMatchForBuy(order, aso);

    if (result) {
      return [result];
    }

    return [];
  }

  async sell(order: OBOrder, listId: MarketListId): Promise<BuyOrderMatch[]> {
    await addSellOrder(listId, order);

    const result = await this.marketMatches();

    return result;
  }

  async marketMatches(): Promise<BuyOrderMatch[]> {
    const result: BuyOrderMatch[] = [];
    const aso = new ActiveSellOrders();

    const orders = await buyOrders(MarketListId.ValidActive);
    for (const buyOrder of orders) {
      if (!isOBOrderExpired(buyOrder)) {
        const order = await this.findMatchForBuy(buyOrder, aso);
        if (order) {
          result.push(order);
        }
      }
    }

    return result;
  }

  async findMatchForBuy(buyOrder: OBOrder, aso: ActiveSellOrders): Promise<BuyOrderMatch | null> {
    const sellOrders = await aso.ordersForBuyOrder(buyOrder);

    if (sellOrders.length > 0) {
      let cash = getCurrentOBOrderPrice(buyOrder);
      let numNFTs = BigNumber.from(buyOrder.numItems).toNumber();
      const result: OBOrder[] = [];

      for (const sellOrder of sellOrders) {
        const price = getCurrentOBOrderPrice(sellOrder);

        if (numNFTs > 0 && cash >= price) {
          result.push(sellOrder);
          cash = cash.sub(price);
          numNFTs = numNFTs - 1;
        } else {
          break;
        }
      }

      if (result.length === numNFTs) {
        return { buyOrder: buyOrder, sellOrders: result };
      }
    }

    return null;
  }
}

// ---------------------------------------------------------------
// Singleton

export const marketOrders: MarketOrders = container.resolve(MarketOrders);
