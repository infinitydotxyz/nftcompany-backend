// todo: the below stuff doesn't belong in orders service; commenting to reference this when moved to another repo

// import { MarketListId } from '@infinityxyz/lib/types/core';
// import { isOBOrderExpired } from '@infinityxyz/lib/utils';
// import { expiredOrders, moveOrder } from './marketFirebase';
// import { marketOrders } from './marketOrders';

// // ---------------------------------------------------------------
// // MarketOrderTask

// const fiveSecondDelay: number = 5 * 1000;
// const fifteenMinuteDelay: number = 15 * (60 * 1000);

// export class MarketOrderTask {
//   expiredScanTimer: NodeJS.Timeout | undefined;
//   matchScanTimer: NodeJS.Timeout | undefined;

//   constructor() {
//     // Schedule a scan
//     this.scan();

//     setInterval(() => {
//       this.scan();
//     }, fifteenMinuteDelay);
//   }

//   scan() {
//     this.scanForExpiredOrders();
//     this.scanForMatches();
//   }

//   scanForExpiredOrders() {
//     if (!this.expiredScanTimer) {
//       this.expiredScanTimer = setTimeout(async () => {
//         try {
//           const orders = await expiredOrders();
//           for (const order of orders) {
//             if (isOBOrderExpired(order.order)) {
//               // Move order to invalid list
//               await moveOrder(order.order, order.listId, MarketListId.Invalid);
//             }
//           }
//         } catch (err) {
//           console.error(err);
//         }

//         this.expiredScanTimer = undefined;
//       }, fiveSecondDelay);
//     }
//   }

//   scanForMatches() {
//     if (!this.matchScanTimer) {
//       this.matchScanTimer = setTimeout(async () => {
//         try {
//           const matches = await marketOrders.marketMatches();

//           // Execute the buys if found
//           for (const m of matches) {
//             await marketOrders.executeBuyOrder(m.buyOrder.id ?? '');
//           }
//         } catch (err) {
//           console.error(err);
//         }

//         this.matchScanTimer = undefined;
//       }, fiveSecondDelay);
//     }
//   }
// }
