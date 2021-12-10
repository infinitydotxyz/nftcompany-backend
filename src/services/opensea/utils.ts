import { ListingType } from '@base/types/NftInterface';
import { RawSellOrder } from '@base/types/OSNftInterface';

export function getOrderTypeFromRawSellOrder(order: RawSellOrder) {
  switch (order?.sale_kind) {
    case 0:
      if (order?.payment_token_contract?.symbol === 'ETH') {
        return ListingType.FixedPrice;
      }
      return ListingType.EnglishAuction;
    case 1:
      return ListingType.DutchAuction;
    default:
  }
}
