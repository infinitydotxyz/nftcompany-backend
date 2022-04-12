// MarketListingsBody in lib

import { MarketOrderType, MarketActionType, MarketListIdType } from '@infinityxyz/lib/types/core';

export class MarketListingsBodyDto {
  orderType: MarketOrderType;
  action: MarketActionType;
  listId?: MarketListIdType;
  orderId?: string; // Delete and move
  moveListId?: MarketListIdType;
}
