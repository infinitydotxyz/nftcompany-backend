import { isOrderExpired } from '@infinityxyz/lib/types/core';
import { marketListingsCache } from './marketListingsCache';
import { marketOrders } from './marketOrders';

// ---------------------------------------------------------------
// MarketOrderTask

const fiveSecondDelay: number = 5 * 1000;
const fifteenMinuteDelay: number = 15 * (60 * 1000);

export class MarketOrderTask {
  expiredScanTimer: NodeJS.Timeout | undefined;
  matchScanTimer: NodeJS.Timeout | undefined;

  constructor() {
    // schedule a scan
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
        for (const order of marketListingsCache.expiredOrders()) {
          if (isOrderExpired(order.order)) {
            // move order to invalid list
            await marketListingsCache._moveOrder(order.order, order.listId, 'invalid');
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

        // execute the buys if found
        for (const m of matches) {
          await marketListingsCache.executeBuyOrder(m.buyOrder.id ?? '');
        }

        this.matchScanTimer = undefined;
      }, fiveSecondDelay);
    }
  }
}
