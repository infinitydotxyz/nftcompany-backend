import { ListingType } from '@base/types/NftInterface';
import { RawSellOrder } from '@base/types/OSNftInterface';
import { openseaParamSerializer } from '@utils/formatters';
import axios from 'axios';

const authKey = process.env.openseaKey;

export const openseaClient = axios.create({
  headers: {
    'X-AUTH-KEY': authKey,
    'X-API-KEY': authKey
  },
  paramsSerializer: openseaParamSerializer
});

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
