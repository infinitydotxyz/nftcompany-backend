import { MarketListId, isOrderSpecExpired } from '@infinityxyz/lib/types/core';
import { expiredOrders, moveOrder } from './marketFirebase';
import { marketOrders } from './marketOrders';

// ---------------------------------------------------------------
// MarketOrderTask

const fiveSecondDelay: number = 5 * 1000;
const fifteenMinuteDelay: number = 15 * (60 * 1000);

export class MarketOrderTask {
  expiredScanTimer: NodeJS.Timeout | undefined;
  matchScanTimer: NodeJS.Timeout | undefined;

  constructor() {
    // Schedule a scan
    this.scan();

    setInterval(() => {
      this.scan();
    }, fifteenMinuteDelay);
  }

  scan() {
    this.scanForExpiredOrders();
    this.scanForMatches();
  }

  scanForExpiredOrders() {
    if (!this.expiredScanTimer) {
      this.expiredScanTimer = setTimeout(async () => {
        const orders = await expiredOrders();
        for (const order of orders) {
          if (isOrderSpecExpired(order.order)) {
            // Move order to invalid list
            await moveOrder(order.order, order.listId, MarketListId.Invalid);
          }
        }

        this.expiredScanTimer = undefined;
      }, fiveSecondDelay);
    }
  }

  scanForMatches() {
    if (!this.matchScanTimer) {
      this.matchScanTimer = setTimeout(async () => {
        const matches = await marketOrders.marketMatches();

        // Execute the buys if found
        for (const m of matches) {
          await marketOrders.executeBuyOrder(m.buyOrder.id ?? '');
        }

        this.matchScanTimer = undefined;
      }, fiveSecondDelay);
    }
  }
}
